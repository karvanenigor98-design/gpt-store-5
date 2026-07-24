import type { SupabaseClient } from "@supabase/supabase-js";

import { isEmailRecipientSuppressed } from "@/lib/email/suppression";
import { sendTransactionalEmail } from "@/lib/email/send-email";
import { canDeliverTelegramHere } from "@/lib/notifications/telegram-egress";
import type { SiteSlug } from "@/lib/sites";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveTelegramBotToken } from "@/lib/telegram/bot-config";

type OutboxRow = {
  id: string;
  channel: "email" | "telegram";
  site_slug: SiteSlug;
  event_type: string;
  recipient: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

type DeliveryResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

function untypedAdmin(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient;
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/password|secret|token|key/gi, "[redacted]").slice(0, 500);
}

function retryAt(attempt: number): string {
  const delayMinutes = Math.min(360, 2 ** Math.min(attempt, 8));
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

/** Release telegram row back to pending without burning attempt (VPS has no TG egress). */
async function deferTelegramRow(admin: SupabaseClient, row: OutboxRow): Promise<void> {
  const now = new Date().toISOString();
  await admin
    .from("notification_outbox")
    .update({
      status: "pending",
      attempts: Math.max(0, row.attempts - 1),
      locked_at: null,
      last_error: "deferred_to_vercel_telegram_egress",
      next_attempt_at: now,
      updated_at: now,
    })
    .eq("id", row.id);
}

async function sendTelegram(row: OutboxRow): Promise<DeliveryResult> {
  const token = resolveTelegramBotToken(row.site_slug);
  const text = typeof row.payload.text === "string" ? row.payload.text : "";
  if (!token || !row.recipient || !text) {
    return { ok: false, error: "telegram_not_configured" };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: row.recipient,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) return { ok: true };
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      error: `telegram_http_${response.status}:${body.slice(0, 120).replace(/\s+/g, " ")}`,
    };
  } catch (error) {
    return { ok: false, error: safeError(error) };
  }
}

async function sendEmail(row: OutboxRow): Promise<DeliveryResult> {
  if (isEmailRecipientSuppressed(row.recipient)) {
    return { ok: false, skipped: true, error: "recipient_suppressed" };
  }

  const subject = typeof row.payload.subject === "string" ? row.payload.subject : "";
  const text = typeof row.payload.text === "string" ? row.payload.text : "";
  const html = typeof row.payload.html === "string" ? row.payload.html : undefined;
  if (!subject || !text) return { ok: false, error: "invalid_email_payload" };

  const result = await sendTransactionalEmail(
    row.recipient,
    subject,
    text,
    html,
    { siteSlug: row.site_slug },
  );
  return { ok: result.ok, skipped: result.skipped, error: result.error };
}

async function updateEmailLog(
  admin: SupabaseClient,
  row: OutboxRow,
  status: "sent" | "failed" | "skipped",
  error?: string,
): Promise<void> {
  const logId = typeof row.payload.logId === "string" ? row.payload.logId : null;
  if (!logId) return;
  await admin
    .from("email_notification_logs")
    .update({
      status,
      error_message: error?.slice(0, 500) ?? null,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", logId);
}

async function completeRow(
  admin: SupabaseClient,
  row: OutboxRow,
  result: DeliveryResult,
): Promise<"sent" | "failed" | "dead" | "skipped"> {
  const now = new Date().toISOString();
  const error = result.error ? safeError(result.error) : null;
  const exhausted = row.attempts >= row.max_attempts;
  const status =
    result.ok ? "sent"
    : result.skipped ? "skipped"
    : exhausted ? "dead"
    : "failed";

  await admin
    .from("notification_outbox")
    .update({
      status,
      locked_at: null,
      updated_at: now,
      sent_at: result.ok ? now : null,
      last_error: error,
      next_attempt_at: status === "failed" ? retryAt(row.attempts) : now,
    })
    .eq("id", row.id);

  try {
    await admin.from("notification_delivery_attempts").insert({
      outbox_id: row.id,
      attempt_no: row.attempts,
      channel: row.channel,
      status: result.ok ? "sent" : result.skipped ? "skipped" : "failed",
      error_message: error,
    });
  } catch {
    /* optional audit table */
  }

  if (row.channel === "email") {
    await updateEmailLog(
      admin,
      row,
      result.ok ? "sent" : result.skipped ? "skipped" : "failed",
      error ?? undefined,
    );
  }
  return status;
}

export async function processNotificationOutbox(limit = 25): Promise<{
  claimed: number;
  sent: number;
  failed: number;
  dead: number;
  skipped: number;
  telegramDeferred: number;
}> {
  const admin = untypedAdmin();
  const { data, error } = await admin.rpc("claim_notification_outbox", {
    p_limit: Math.min(Math.max(limit, 1), 100),
  });
  if (error) throw new Error(`outbox_claim_failed:${error.message}`);

  const rows = ((data ?? []) as OutboxRow[]).slice().sort((a, b) => {
    // Prefer email delivery when SMTP/Telegram latency competes for the cron budget.
    if (a.channel === b.channel) return 0;
    return a.channel === "email" ? -1 : 1;
  });
  const stats = {
    claimed: rows.length,
    sent: 0,
    failed: 0,
    dead: 0,
    skipped: 0,
    telegramDeferred: 0,
  };

  const allowTelegram = canDeliverTelegramHere();

  for (const row of rows) {
    if (row.channel === "telegram" && !allowTelegram) {
      await deferTelegramRow(admin, row);
      stats.telegramDeferred += 1;
      console.info("[notification-outbox] defer telegram to vercel", {
        id: row.id,
        event_type: row.event_type,
      });
      continue;
    }

    const result = row.channel === "telegram" ? await sendTelegram(row) : await sendEmail(row);
    const status = await completeRow(admin, row, result);
    stats[status] += 1;
    console.info("[notification-outbox] deliver", {
      id: row.id,
      channel: row.channel,
      site_slug: row.site_slug,
      event_type: row.event_type,
      status,
      error: result.error ?? null,
    });
  }

  return stats;
}
