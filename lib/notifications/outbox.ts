import type { SiteSlug } from "@/lib/sites";
import { createAdminClient } from "@/lib/supabase/server";

type EnqueueResult = {
  queued: boolean;
  duplicate: boolean;
  error?: string;
};

/**
 * Fire-and-forget drain so delivery does not depend solely on Vercel cron.
 * Cron remains the backup/retry path.
 */
export function kickNotificationOutbox(limit = 10): void {
  void import("@/lib/notifications/outbox-worker")
    .then(({ processNotificationOutbox }) => processNotificationOutbox(limit))
    .then((stats) => {
      if (stats.claimed > 0) {
        console.info("[notification-outbox] kick", {
          claimed: stats.claimed,
          sent: stats.sent,
          failed: stats.failed,
          skipped: stats.skipped,
          dead: stats.dead,
        });
      }
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        "[notification-outbox] kick failed:",
        message.replace(/password|secret|token|key/gi, "[redacted]").slice(0, 300),
      );
    });
}

type BaseOutboxParams = {
  siteSlug: SiteSlug;
  eventType: string;
  recipient: string;
  dedupeKey: string;
};

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/password|secret|token|key/gi, "[redacted]").slice(0, 500);
}

async function enqueue(
  params: BaseOutboxParams & {
    channel: "email" | "telegram";
    payload: Record<string, unknown>;
  },
): Promise<EnqueueResult> {
  const dedupeKey = `${params.channel}:${params.dedupeKey}:${params.recipient.toLowerCase()}`;
  try {
    // Table may be absent from generated Database types until regen.
    const admin = createAdminClient() as unknown as {
      from: (table: string) => {
        insert: (row: Record<string, unknown>) => Promise<{
          error: { code?: string; message?: string } | null;
        }>;
      };
    };
    const { error } = await admin.from("notification_outbox").insert({
      channel: params.channel,
      site_slug: params.siteSlug,
      event_type: params.eventType,
      recipient: params.recipient,
      payload: params.payload,
      dedupe_key: dedupeKey,
      status: "pending",
      next_attempt_at: new Date().toISOString(),
    });

    if (!error) {
      kickNotificationOutbox(10);
      return { queued: true, duplicate: false };
    }
    if (error.code === "23505") {
      // Duplicate still means a row exists — nudge worker in case prior send stalled.
      kickNotificationOutbox(5);
      return { queued: true, duplicate: true };
    }
    return { queued: false, duplicate: false, error: safeError(error.message) };
  } catch (error) {
    return { queued: false, duplicate: false, error: safeError(error) };
  }
}

export async function enqueueEmailNotification(
  params: BaseOutboxParams & {
    subject: string;
    text: string;
    html: string;
    logId?: string | null;
  },
): Promise<EnqueueResult> {
  return enqueue({
    ...params,
    channel: "email",
    payload: {
      subject: params.subject,
      text: params.text,
      html: params.html,
      logId: params.logId ?? null,
    },
  });
}

export async function enqueueTelegramNotification(
  params: Omit<BaseOutboxParams, "recipient"> & {
    chatId: string;
    text: string;
  },
): Promise<EnqueueResult> {
  return enqueue({
    ...params,
    recipient: params.chatId,
    channel: "telegram",
    payload: { text: params.text },
  });
}
