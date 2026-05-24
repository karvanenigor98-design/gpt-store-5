import type { SiteSlug } from "@/lib/sites";
import { getPublicBrandNameShort } from "@/lib/sites";

import { buildBrandedEmail } from "@/lib/email/templates/layout";
import { buildCustomerOrderUrl } from "@/lib/email/site-urls";

export function unpaidOrderReminderEmail(params: {
  siteSlug: SiteSlug;
  planName: string;
  price: number;
  orderId: string;
}): { subject: string; text: string; html: string } {
  const brand = getPublicBrandNameShort(params.siteSlug);
  const product =
    params.siteSlug === "subs-store" ? "Spotify Premium" : "ChatGPT Plus";

  const title =
    params.siteSlug === "subs-store"
      ? "Вы начали оформление Spotify Premium — оплата ещё не завершена"
      : "Вы начали оформление ChatGPT Plus — оплата ещё не завершена";

  const bodyLines = [
    `Вы выбрали тариф «${params.planName}» на сумму ${params.price} ₽.`,
    "Заказ сохранён — оплату можно завершить в личном кабинете.",
    "Если нужна помощь, напишите в чат поддержки на сайте.",
  ];

  const branded = buildBrandedEmail({
    siteSlug: params.siteSlug,
    title,
    bodyLines,
    ctaLabel: "Завершить оплату",
    ctaUrl: buildCustomerOrderUrl(params.siteSlug, params.orderId),
  });

  return {
    subject: `${title} — ${brand}`,
    text: branded.text,
    html: branded.html,
  };
}

export const UNPAID_REMINDER_DELAY_MINUTES = Number(
  process.env.UNPAID_ORDER_REMINDER_DELAY_MINUTES ?? "60",
);

export function unpaidReminderDedupeKey(siteSlug: SiteSlug, orderId: string): string {
  return `awaiting_payment_reminder:${siteSlug}:${orderId}`;
}
