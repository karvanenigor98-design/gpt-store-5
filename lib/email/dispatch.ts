import { createAdminClient } from "@/lib/supabase/server";
import type { SiteSlug } from "@/lib/sites";

import {
  eventCategory,
  type EmailEventType,
} from "@/lib/email/events";
import { collectStaffRecipientsForSite } from "@/lib/email/recipients";
import {
  getSiteEmailSettings,
  isCategoryEnabled,
  isRecipientRoleEnabled,
} from "@/lib/email/settings";
import { buildBrandedEmail } from "@/lib/email/templates/layout";
import {
  hasAnyEmailProvider,
  isEmailNotificationsEnabled,
} from "@/lib/email/config";
import { normalizeCustomerEmail } from "@/lib/email/resolve-order-customer-email";
import { isEmailRecipientSuppressed } from "@/lib/email/suppression";
import { enqueueEmailNotification } from "@/lib/notifications/outbox";
import {
  notifyAdminEmailFailure,
  sendTransactionalEmail,
} from "@/lib/email/send-email";

export type DispatchEmailParams = {
  siteSlug: SiteSlug;
  eventType: EmailEventType;
  recipientEmail: string;
  recipientRole: "client" | "admin" | "operator" | "staff";
  recipientUserId?: string | null;
  title: string;
  bodyLines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  /** Уникальный ключ события — защита от дублей */
  dedupeKey?: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  /** Переопределить subject из шаблона */
  subjectOverride?: string;
};

const DEDUPE_WINDOW_MS = 5 * 60_000;

/**
 * События, которые нельзя слать повторно даже через часы/дни
 * (webhook retry, повторный PATCH того же статуса, reorder staff list).
 */
const PERMANENT_DEDUPE_PREFIXES = [
  "order_paid:",
  "staff_new_order:",
  "staff:new_order:",
  "staff:payment_success:",
  "staff:payment_failed:",
  "order_created:",
  "order_status:",
  "review:",
  "promo:",
  "subscription_activated:",
  "payment_received:",
  "payment_failed:",
] as const;

function isPermanentDedupeKey(dedupeKey: string): boolean {
  return PERMANENT_DEDUPE_PREFIXES.some((p) => dedupeKey.startsWith(p));
}

/** pending|sent — блокируем гонку до завершения outbox-worker. */
async function hasActiveDedupe(dedupeKey: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("email_notification_logs")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .in("status", ["pending", "sent"])
      .limit(1);
    return Boolean(data?.length);
  } catch {
    return false;
  }
}

async function hasRecentDedupe(dedupeKey: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
    const { data } = await admin
      .from("email_notification_logs")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .in("status", ["pending", "sent"])
      .gte("created_at", since)
      .limit(1);
    return Boolean(data?.length);
  } catch {
    return false;
  }
}

async function isDedupeBlocked(dedupeKey: string): Promise<boolean> {
  if (isPermanentDedupeKey(dedupeKey)) {
    return hasActiveDedupe(dedupeKey);
  }
  return hasRecentDedupe(dedupeKey);
}

async function insertLog(row: {
  siteSlug: SiteSlug;
  recipientEmail: string;
  recipientRole: string;
  recipientUserId?: string | null;
  eventType: EmailEventType;
  subject: string;
  preview: string;
  status: "pending" | "sent" | "failed" | "skipped";
  dedupeKey?: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  errorMessage?: string | null;
}): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("email_notification_logs")
      .insert({
        site_slug: row.siteSlug,
        recipient_email: row.recipientEmail,
        recipient_role: row.recipientRole,
        recipient_user_id: row.recipientUserId ?? null,
        event_type: row.eventType,
        subject: row.subject.slice(0, 500),
        preview: row.preview.slice(0, 300),
        status: row.status,
        dedupe_key: row.dedupeKey ?? null,
        related_entity_type: row.relatedEntityType ?? null,
        related_entity_id: row.relatedEntityId ?? null,
        error_message: row.errorMessage ?? null,
        sent_at: row.status === "sent" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[email/dispatch] log insert:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.error("[email/dispatch] log insert:", err);
    return null;
  }
}

async function updateLogStatus(
  logId: string | null,
  status: "sent" | "failed" | "skipped",
  errorMessage?: string,
): Promise<void> {
  if (!logId) return;
  try {
    const admin = createAdminClient();
    await admin
      .from("email_notification_logs")
      .update({
        status,
        error_message: errorMessage?.slice(0, 500) ?? null,
        sent_at: status === "sent" ? new Date().toISOString() : null,
      })
      .eq("id", logId);
  } catch {
    /* ignore */
  }
}

/** Одно transactional письмо с настройками сайта, dedupe и логом. */
export async function dispatchSiteEmail(params: DispatchEmailParams): Promise<{
  sent: boolean;
  skipped: boolean;
  reason?: string;
}> {
  const email = normalizeCustomerEmail(params.recipientEmail);
  if (!email) {
    return { sent: false, skipped: true, reason: "invalid_recipient" };
  }
  if (isEmailRecipientSuppressed(email)) {
    await insertLog({
      siteSlug: params.siteSlug,
      recipientEmail: email,
      recipientRole: params.recipientRole,
      recipientUserId: params.recipientUserId,
      eventType: params.eventType,
      subject: params.title,
      preview: params.bodyLines[0] ?? "",
      status: "skipped",
      dedupeKey: params.dedupeKey,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
      errorMessage: "recipient_suppressed",
    });
    return { sent: false, skipped: true, reason: "recipient_suppressed" };
  }

  if (!isEmailNotificationsEnabled()) {
    return { sent: false, skipped: true, reason: "globally_disabled" };
  }

  const settings = await getSiteEmailSettings(params.siteSlug);
  const category = eventCategory(params.eventType);

  if (!isCategoryEnabled(settings, category)) {
    await insertLog({
      siteSlug: params.siteSlug,
      recipientEmail: email,
      recipientRole: params.recipientRole,
      recipientUserId: params.recipientUserId,
      eventType: params.eventType,
      subject: params.title,
      preview: params.bodyLines[0] ?? "",
      status: "skipped",
      dedupeKey: params.dedupeKey,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
      errorMessage: "category_disabled",
    });
    return { sent: false, skipped: true, reason: "category_disabled" };
  }

  if (!isRecipientRoleEnabled(settings, params.recipientRole)) {
    await insertLog({
      siteSlug: params.siteSlug,
      recipientEmail: email,
      recipientRole: params.recipientRole,
      recipientUserId: params.recipientUserId,
      eventType: params.eventType,
      subject: params.title,
      preview: params.bodyLines[0] ?? "",
      status: "skipped",
      dedupeKey: params.dedupeKey,
      errorMessage: "role_disabled",
    });
    return { sent: false, skipped: true, reason: "role_disabled" };
  }

  if (params.dedupeKey && (await isDedupeBlocked(params.dedupeKey))) {
    return { sent: false, skipped: true, reason: "dedupe" };
  }

  const branded = buildBrandedEmail({
    siteSlug: params.siteSlug,
    title: params.title,
    bodyLines: params.bodyLines,
    ctaLabel: params.ctaLabel,
    ctaUrl: params.ctaUrl,
  });

  const subject = params.subjectOverride ?? branded.subject;
  const preview = params.bodyLines.join(" ").slice(0, 280);

  const logId = await insertLog({
    siteSlug: params.siteSlug,
    recipientEmail: email,
    recipientRole: params.recipientRole,
    recipientUserId: params.recipientUserId,
    eventType: params.eventType,
    subject,
    preview,
    status: "pending",
    dedupeKey: params.dedupeKey,
    relatedEntityType: params.relatedEntityType,
    relatedEntityId: params.relatedEntityId,
  });

  if (!hasAnyEmailProvider()) {
    await updateLogStatus(logId, "skipped", "email_provider_not_configured");
    return { sent: false, skipped: true, reason: "email_provider_not_configured" };
  }

  const queued = await enqueueEmailNotification({
    siteSlug: params.siteSlug,
    eventType: params.eventType,
    recipient: email,
    dedupeKey: params.dedupeKey ?? `${params.eventType}:${params.relatedEntityId ?? logId ?? email}`,
    subject,
    text: branded.text,
    html: branded.html,
    logId,
  });

  if (queued.queued) {
    // Worker обновит email_notification_logs; pending остаётся до delivery.
    return { sent: true, skipped: false, reason: queued.duplicate ? "outbox_duplicate" : "outbox_queued" };
  }

  // Fallback: прямой send, если outbox ещё не задеплоен / таблица отсутствует.
  console.warn("[email/dispatch] outbox enqueue failed, direct send:", queued.error);
  const result = await sendTransactionalEmail(email, subject, branded.text, branded.html, {
    siteSlug: params.siteSlug,
  });

  if (result.ok) {
    await updateLogStatus(logId, "sent");
    return { sent: true, skipped: false };
  }

  const safeError = result.skipped
    ? "skipped"
    : (result.error ?? "send_failed").replace(/password|secret|key/gi, "[redacted]");

  await updateLogStatus(logId, result.skipped ? "skipped" : "failed", safeError);

  if (!result.skipped) {
    console.error("[email/dispatch] send failed:", safeError, params.eventType);
    void notifyAdminEmailFailure(subject, safeError);
  }

  return { sent: false, skipped: result.skipped, reason: safeError };
}

/** Рассылка staff по сайту (исключая автора) + зеркало в Telegram admin chat. */
export async function dispatchStaffSiteEmails(params: {
  siteSlug: SiteSlug;
  eventType: EmailEventType;
  title: string;
  bodyLines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  dedupeKey?: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  excludeUserId?: string | null;
  excludeEmail?: string | null;
}): Promise<void> {
  const staff = await collectStaffRecipientsForSite(params.siteSlug, {
    excludeUserId: params.excludeUserId,
    excludeEmail: params.excludeEmail,
  });

  const baseKey = params.dedupeKey ?? `${params.eventType}:${params.siteSlug}:${params.relatedEntityId ?? "x"}`;

  // Telegram mirror is independent of staff recipient list / email provider.
  void import("@/lib/telegram/staff-mirror")
    .then(({ mirrorStaffEmailToTelegram }) =>
      mirrorStaffEmailToTelegram({
        siteSlug: params.siteSlug,
        eventType: params.eventType,
        title: params.title,
        bodyLines: params.bodyLines,
        ctaLabel: params.ctaLabel,
        ctaUrl: params.ctaUrl,
        dedupeKey: baseKey,
      }),
    )
    .catch((err) => {
      console.error("[email/dispatch] telegram mirror failed:", err);
    });

  // Не блокируем checkout/API: Resend rate limit не должен задерживать ответ клиенту.
  // Важно: без :idx — порядок staff из БД/env нестабилен и ломал идемпотентность.
  void Promise.all(
    staff.map((s) =>
      dispatchSiteEmail({
        siteSlug: params.siteSlug,
        eventType: params.eventType,
        recipientEmail: s.email,
        recipientRole: s.role,
        recipientUserId: s.userId,
        title: params.title,
        bodyLines: params.bodyLines,
        ctaLabel: params.ctaLabel,
        ctaUrl: params.ctaUrl,
        dedupeKey: `${baseKey}:staff:${s.email}`,
        relatedEntityType: params.relatedEntityType,
        relatedEntityId: params.relatedEntityId,
      }),
    ),
  ).catch((err) => {
    console.error("[email/dispatch] staff batch failed:", err);
  });
}
