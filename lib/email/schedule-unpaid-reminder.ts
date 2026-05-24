import { createAdminClient } from "@/lib/supabase/server";
import type { SiteSlug } from "@/lib/sites";

import {
  UNPAID_REMINDER_DELAY_MINUTES,
  unpaidReminderDedupeKey,
} from "@/lib/email/unpaid-order-reminder";

/** Запланировать delayed reminder по неоплаченному заказу (идемпотентно). */
export async function scheduleUnpaidOrderReminder(params: {
  siteSlug: SiteSlug;
  orderId: string;
  recipientEmail: string;
  planName: string;
  price: number;
}): Promise<void> {
  const email = params.recipientEmail.trim().toLowerCase();
  if (!email) return;

  const delayMs = Math.max(5, UNPAID_REMINDER_DELAY_MINUTES) * 60_000;
  const scheduledAt = new Date(Date.now() + delayMs).toISOString();
  const dedupeKey = unpaidReminderDedupeKey(params.siteSlug, params.orderId);

  try {
    const admin = createAdminClient();
    await admin.from("scheduled_email_jobs").upsert(
      {
        site_slug: params.siteSlug,
        order_id: params.orderId,
        event_type: "awaiting_payment_reminder",
        recipient_email: email,
        scheduled_at: scheduledAt,
        status: "pending",
        dedupe_key: dedupeKey,
        metadata: {
          planName: params.planName,
          price: params.price,
        },
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    );
  } catch (err) {
    console.error("[scheduleUnpaidOrderReminder]", err);
  }
}

/** Отменить reminder после оплаты. */
export async function cancelUnpaidOrderReminder(siteSlug: SiteSlug, orderId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin
      .from("scheduled_email_jobs")
      .update({ status: "cancelled" })
      .eq("dedupe_key", unpaidReminderDedupeKey(siteSlug, orderId))
      .eq("status", "pending");
  } catch {
    /* ignore */
  }
}
