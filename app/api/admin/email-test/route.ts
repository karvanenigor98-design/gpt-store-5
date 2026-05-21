import { NextRequest, NextResponse } from "next/server";

import { dispatchSiteEmail } from "@/lib/email/dispatch";
import { buildStaffOrderUrl, buildCustomerOrderUrl } from "@/lib/email/site-urls";
import { isServerAdmin } from "@/lib/auth/server-role";
import { createClient } from "@/lib/supabase/server";
import type { SiteSlug } from "@/lib/sites";

const TEST_ORDER_ID = "00000000-0000-4000-8000-000000000001";

/**
 * POST /api/admin/email-test
 * Body: { siteSlug: "gpt-store"|"subs-store", role: "client"|"admin"|"operator", to?: string }
 * Только admin. Не отправляет реальным клиентам без явного `to`.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isServerAdmin(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { siteSlug?: string; role?: string; to?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const siteSlug = (body.siteSlug === "subs-store" ? "subs-store" : "gpt-store") as SiteSlug;
  const role = body.role === "client" ? "client" : body.role === "operator" ? "operator" : "admin";
  const to = body.to?.trim().toLowerCase() || user.email?.trim().toLowerCase();

  if (!to) {
    return NextResponse.json({ error: "Нет email получателя" }, { status: 400 });
  }

  const brand = siteSlug === "subs-store" ? "Subs Store" : "GPT STORE";
  const isStaff = role !== "client";

  const result = await dispatchSiteEmail({
    siteSlug,
    eventType: "order_paid",
    recipientEmail: to,
    recipientRole: role,
    recipientUserId: role === "client" ? null : user.id,
    title: `[Тест] ${isStaff ? "Новая оплата" : "Оплата получена"} — ${brand}`,
    bodyLines: isStaff
      ? [
          "Тестовое письмо для staff после оплаты.",
          `Сайт: ${brand}`,
          "Клиент: test@example.com",
          "Тариф: Тестовый тариф",
          "Сумма: 999 ₽",
          "Клиент оплатил подписку — обработайте заказ (тест).",
        ]
      : [
          "Тестовое письмо клиенту: оплата получена, заказ в работе.",
          "Тариф: Тестовый тариф",
          "Сумма: 999 ₽",
        ],
    ctaLabel: isStaff ? "Открыть заказы" : "Открыть заказ",
    ctaUrl: isStaff
      ? buildStaffOrderUrl(siteSlug, TEST_ORDER_ID)
      : buildCustomerOrderUrl(siteSlug, TEST_ORDER_ID),
    dedupeKey: `order_paid:test:${siteSlug}:${role}:${to}:${Date.now()}`,
    relatedEntityType: "order",
    relatedEntityId: TEST_ORDER_ID,
  });

  return NextResponse.json({
    ok: true,
    siteSlug,
    role,
    to,
    sent: result.sent,
    skipped: result.skipped,
    reason: result.reason,
  });
}
