import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { dispatchSiteEmail } from "@/lib/email/dispatch";
import { previewUnpaidOrderCampaign } from "@/lib/email/unpaid-campaign";
import { unpaidOrderReminderEmail } from "@/lib/email/unpaid-order-reminder";
import { resolveServerRole } from "@/lib/auth/server-role";
import type { SiteSlug } from "@/lib/sites";
import { buildCustomerOrderUrl } from "@/lib/email/site-urls";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await resolveServerRole(user);
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
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

export async function POST(req: NextRequest) {
  const denied = await requireStaff();
  if (denied) return denied;

  let body: {
    site?: string;
    period?: string;
    subject?: string;
    bodyText?: string;
    confirm?: boolean;
    excludeEmails?: string[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  if (!body.confirm) {
    return NextResponse.json({ error: "Требуется подтверждение (confirm: true)" }, { status: 400 });
  }

  const siteSlug = (body.site === "subs-store" ? "subs-store" : "gpt-store") as SiteSlug;
  const period = body.period ?? "7d";
  const campaignId = randomUUID();
  const excludeSet = new Set(
    (body.excludeEmails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean),
  );

  const preview = await previewUnpaidOrderCampaign({ siteSlug, period });
  const subjectTemplate = body.subject?.trim();
  const bodyTemplate = body.bodyText?.trim();
  const brand = siteSlug === "subs-store" ? "SPOTIFY STORE" : "GPT STORE";

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let duplicate = 0;
  let excluded = 0;

  const admin = createAdminClient();
  const seenInRun = new Set<string>();

  for (const recipient of preview.recipients) {
    if (excludeSet.has(recipient.email)) {
      excluded += 1;
      await admin.from("email_campaign_logs").insert({
        campaign_id: campaignId,
        site_slug: siteSlug,
        recipient_email: recipient.email,
        order_id: recipient.orderId,
        status: "skipped",
        error_message: "excluded_by_admin",
      });
      continue;
    }

    if (seenInRun.has(recipient.email)) {
      duplicate += 1;
      await admin.from("email_campaign_logs").insert({
        campaign_id: campaignId,
        site_slug: siteSlug,
        recipient_email: recipient.email,
        order_id: recipient.orderId,
        status: "duplicate",
      });
      continue;
    }
    seenInRun.add(recipient.email);

    const stillUnpaid = await isOrderStillUnpaid(siteSlug, recipient.orderId);
    if (!stillUnpaid) {
      skipped += 1;
      await admin.from("email_campaign_logs").insert({
        campaign_id: campaignId,
        site_slug: siteSlug,
        recipient_email: recipient.email,
        order_id: recipient.orderId,
        status: "skipped",
        error_message: "already_paid",
      });
      continue;
    }

    const defaultMail = unpaidOrderReminderEmail({
      siteSlug,
      planName: recipient.planName,
      price: recipient.price,
      orderId: recipient.orderId,
    });

    let subject = defaultMail.subject;
    let bodyLines = [
      `Тариф: ${recipient.planName}`,
      `Сумма: ${recipient.price} ₽`,
      "Завершите оплату в личном кабинете.",
    ];

    if (bodyTemplate) {
      bodyLines = bodyTemplate
        .split("\n")
        .filter(Boolean)
        .map((line) =>
          line
            .replace(/\{plan\}/g, recipient.planName)
            .replace(/\{price\}/g, String(recipient.price))
            .replace(/\{email\}/g, recipient.email),
        );
    }

    if (subjectTemplate) {
      subject = `${subjectTemplate} — ${brand}`;
    }

    const result = await dispatchSiteEmail({
      siteSlug,
      eventType: "order_status_changed",
      recipientEmail: recipient.email,
      recipientRole: "client",
      title: subjectTemplate || (siteSlug === "subs-store"
        ? "Оплата Spotify Premium ещё не завершена"
        : "Оплата ChatGPT Plus ещё не завершена"),
      bodyLines,
      ctaLabel: "Завершить оплату",
      ctaUrl: buildCustomerOrderUrl(siteSlug, recipient.orderId),
      dedupeKey: `campaign:${campaignId}:${recipient.email}`,
      relatedEntityType: "order",
      relatedEntityId: recipient.orderId,
      subjectOverride: subject,
    });

    const status = result.sent ? "sent" : result.skipped ? "skipped" : "failed";
    if (result.sent) sent += 1;
    else if (result.skipped) skipped += 1;
    else failed += 1;

    await admin.from("email_campaign_logs").insert({
      campaign_id: campaignId,
      site_slug: siteSlug,
      recipient_email: recipient.email,
      order_id: recipient.orderId,
      status,
      error_message: result.reason ?? null,
    });
  }

  return NextResponse.json({
    campaignId,
    sent,
    failed,
    skipped,
    duplicate,
    excluded,
    total: preview.uniqueEmails,
  });
}
