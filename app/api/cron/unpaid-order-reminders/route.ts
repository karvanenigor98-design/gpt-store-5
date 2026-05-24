import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { dispatchSiteEmail } from "@/lib/email/dispatch";
import { unpaidOrderReminderEmail } from "@/lib/email/unpaid-order-reminder";
import { cancelUnpaidOrderReminder } from "@/lib/email/schedule-unpaid-reminder";
import { buildCustomerOrderUrl } from "@/lib/email/site-urls";
import type { SiteSlug } from "@/lib/sites";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}` || req.headers.get("x-cron-secret") === secret;
}

async function isOrderStillUnpaid(siteSlug: SiteSlug, orderId: string): Promise<boolean> {
  if (siteSlug === "subs-store") {
    const subs = createSubsStoreAdminClient();
    if (!subs) return false;
    const { data } = await subs
      .from("orders")
      .select("status,payment_status")
      .eq("id", orderId)
      .maybeSingle();
    return data?.status === "awaiting_payment" && data?.payment_status === "pending";
  }

  const admin = createAdminClient();
  const { data } = await admin.from("orders").select("status").eq("id", orderId).maybeSingle();
  return data?.status === "pending";
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: jobs, error } = await admin
    .from("scheduled_email_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const job of jobs ?? []) {
    const siteSlug = job.site_slug as SiteSlug;
    const orderId = job.order_id as string;
    const email = (job.recipient_email as string).trim().toLowerCase();
    const meta = (job.metadata ?? {}) as { planName?: string; price?: number };

    const stillUnpaid = await isOrderStillUnpaid(siteSlug, orderId);
    if (!stillUnpaid) {
      await admin
        .from("scheduled_email_jobs")
        .update({ status: "skipped", sent_at: now })
        .eq("id", job.id);
      await cancelUnpaidOrderReminder(siteSlug, orderId);
      skipped += 1;
      continue;
    }

    const mail = unpaidOrderReminderEmail({
      siteSlug,
      planName: meta.planName ?? "Подписка",
      price: Number(meta.price ?? 0),
      orderId,
    });

    const result = await dispatchSiteEmail({
      siteSlug,
      eventType: "order_status_changed",
      recipientEmail: email,
      recipientRole: "client",
      title:
        siteSlug === "subs-store"
          ? "Вы начали оформление Spotify Premium — оплата ещё не завершена"
          : "Вы начали оформление ChatGPT Plus — оплата ещё не завершена",
      bodyLines: [
        `Тариф: ${meta.planName ?? "—"}`,
        `Сумма: ${meta.price ?? 0} ₽`,
        "Завершите оплату в личном кабинете.",
      ],
      ctaLabel: "Завершить оплату",
      ctaUrl: buildCustomerOrderUrl(siteSlug, orderId),
      dedupeKey: job.dedupe_key as string,
      relatedEntityType: "order",
      relatedEntityId: orderId,
      subjectOverride: mail.subject,
    });

    if (result.sent) {
      await admin
        .from("scheduled_email_jobs")
        .update({ status: "sent", sent_at: now })
        .eq("id", job.id);
      sent += 1;
    } else if (result.skipped) {
      await admin
        .from("scheduled_email_jobs")
        .update({ status: "skipped", sent_at: now })
        .eq("id", job.id);
      skipped += 1;
    } else {
      await admin
        .from("scheduled_email_jobs")
        .update({ status: "failed" })
        .eq("id", job.id);
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, processed: (jobs ?? []).length, sent, skipped, failed });
}
