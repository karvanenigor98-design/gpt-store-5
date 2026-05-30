/**
 * Единая точка: оплата получена → in-app уведомления + email (client, admin, operator).
 * Не бросает исключения наружу — ошибки email не откатывают paid.
 */

import { dispatchSiteEmail, dispatchStaffSiteEmails } from "@/lib/email/dispatch";
import { resolveOrderCustomerEmail } from "@/lib/email/resolve-order-customer-email";
import {
  buildCustomerChatUrl,
  buildCustomerOrderUrl,
  buildStaffOrderUrl,
} from "@/lib/email/site-urls";
import { getOrderCustomerInstructionLines } from "@/lib/email/order-customer-instructions";
import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { SiteSlug } from "@/lib/sites";
import { getSiteBySlug } from "@/lib/sites";

import {
  recordGptStaffNotification,
  recordSubsStaffNotification,
} from "@/lib/notifications/staff-events";
import { cancelUnpaidOrderReminder } from "@/lib/email/schedule-unpaid-reminder";
import {
  isPaidLikeStatus,
  isTransitionToPaidLike,
} from "@/lib/orders/paid-like-status";

export { isPaidLikeStatus, isTransitionToPaidLike };

const STATUS_RU: Record<string, string> = {
  pending: "Ожидает оплаты",
  paid: "Оплачен",
  activating: "В активации",
  active: "Активирован",
  processing: "В обработке",
  awaiting_payment: "Ожидает оплаты",
  activated: "Активирован",
  completed: "Завершён",
};

/** Сайт заказа в GPT Supabase (orders). */
export function resolveGptOrderSiteSlug(order: {
  product?: string | null;
  meta?: unknown;
}): SiteSlug {
  const meta = order.meta as Record<string, unknown> | null;
  if (order.product === "spotify-premium" || meta?.site === "subs-store") {
    return "subs-store";
  }
  return "gpt-store";
}

function formatPaidAt(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function orderPaidDedupeKey(siteSlug: SiteSlug, orderId: string, email: string): string {
  return `order_paid:${siteSlug}:${orderId}:${email.trim().toLowerCase()}`;
}

async function detectRenewal(
  siteSlug: SiteSlug,
  customerUserId: string | null | undefined,
  orderId: string,
): Promise<boolean> {
  if (!customerUserId) return false;
  try {
    if (siteSlug === "subs-store") {
      const subs = createSubsStoreAdminClient();
      if (!subs) return false;
      const { count } = await subs
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", customerUserId)
        .neq("id", orderId)
        .in("status", ["paid", "processing", "activated", "completed"]);
      return (count ?? 0) > 0;
    }
    const admin = createAdminClient();
    const { count } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", customerUserId)
      .neq("id", orderId)
      .in("status", ["paid", "activating", "active", "waiting_client"]);
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

export type OrderPaidNotificationParams = {
  orderId: string;
  siteSlug: SiteSlug;
  planName: string;
  price: number;
  status: string;
  customerEmail: string | null;
  customerUserId?: string | null;
  /** Email аккаунта ChatGPT / Spotify из заказа */
  accountEmail?: string | null;
  paidAt?: string;
  isRenewal?: boolean;
};

/**
 * Отправка email + in-app после успешной оплаты.
 * Идемпотентно по dedupe_key на получателя.
 */
export async function handleOrderPaidNotification(
  params: OrderPaidNotificationParams,
): Promise<void> {
  try {
    const site = getSiteBySlug(params.siteSlug);
    const brand = site.brandName;
    const statusLabel = STATUS_RU[params.status] ?? params.status;
    const paidAtLabel = formatPaidAt(params.paidAt);
    const isRenewal =
      params.isRenewal ??
      (await detectRenewal(params.siteSlug, params.customerUserId, params.orderId));

    const clientEmail = resolveOrderCustomerEmail({
      profileEmail: params.customerEmail,
      accountEmail: params.accountEmail,
    });
    const shortId = params.orderId.slice(0, 8);

    const staffTitle = isRenewal
      ? `Повторная оплата — ${brand}`
      : `Клиент оплатил заказ — ${brand}`;

    const staffMessage = isRenewal
      ? `Клиент ${clientEmail ?? "—"} продлил подписку: ${params.planName}, ${params.price} ₽.`
      : `Клиент ${clientEmail ?? "—"} оплатил: ${params.planName}, ${params.price} ₽.`;

    const siteSlug = params.siteSlug as "gpt-store" | "subs-store";
    await cancelUnpaidOrderReminder(siteSlug, params.orderId);

    await recordGptStaffNotification({
      type: "payment_success",
      title: staffTitle,
      message: staffMessage,
      siteSlug,
      entity_type: "order",
      entity_id: params.orderId,
    });

    if (params.siteSlug === "subs-store") {
      await recordSubsStaffNotification({
        type: "payment_success",
        title: `SPOTIFY STORE: ${isRenewal ? "продление" : "новая оплата"}`,
        message: staffMessage,
        entity_type: "order",
        entity_id: params.orderId,
        sendEmail: false,
      });
    }

    const staffBodyLines = [
      `Сайт: ${brand}`,
      `Клиент: ${clientEmail ?? "не указан"}`,
      `Тариф: ${params.planName}`,
      `Сумма: ${params.price.toLocaleString("ru-RU")} ₽`,
      `Дата оплаты: ${paidAtLabel}`,
      `Статус заказа: ${statusLabel}`,
      isRenewal
        ? "Повторная оплата — проверьте продление подписки."
        : "Клиент оплатил подписку — обработайте заказ.",
    ];

    if (params.accountEmail?.trim()) {
      staffBodyLines.splice(2, 0, `Аккаунт в заказе: ${params.accountEmail.trim()}`);
    }

    await dispatchStaffSiteEmails({
      siteSlug: params.siteSlug,
      eventType: "order_paid",
      title: staffTitle,
      bodyLines: staffBodyLines,
      ctaLabel: "Открыть заказ",
      ctaUrl: buildStaffOrderUrl(params.siteSlug, params.orderId),
      dedupeKey: `order_paid:staff:${params.siteSlug}:${params.orderId}`,
      relatedEntityType: "order",
      relatedEntityId: params.orderId,
    });

    if (!clientEmail) {
      console.warn("[order-paid] no client email for order", params.orderId.slice(0, 8));
    }

    if (clientEmail) {
      const clientLines = [
        "Оплата получена. Мы уже передали заказ в работу и скоро начнём активацию подписки.",
        `Тариф: ${params.planName}`,
        `Сумма: ${params.price.toLocaleString("ru-RU")} ₽`,
        `Номер заказа: ${shortId}…`,
        ...getOrderCustomerInstructionLines(params.siteSlug, params.status, "paid"),
      ];

      if (params.siteSlug === "subs-store") {
        clientLines.push(
          "Если для активации потребуются данные Spotify-аккаунта, оператор заранее напишет вам в поддержку и объяснит, что нужно.",
        );
      }

      if (isRenewal) {
        clientLines.unshift("Спасибо за продление! Повторная оплата успешно получена.");
      }

      await dispatchSiteEmail({
        siteSlug: params.siteSlug,
        eventType: "order_paid",
        recipientEmail: clientEmail,
        recipientRole: "client",
        recipientUserId: params.customerUserId,
        title: isRenewal ? "Оплата продления получена" : "Оплата получена",
        bodyLines: clientLines,
        ctaLabel: "Статус заказа",
        ctaUrl: buildCustomerOrderUrl(params.siteSlug, params.orderId),
        dedupeKey: orderPaidDedupeKey(params.siteSlug, params.orderId, clientEmail),
        relatedEntityType: "order",
        relatedEntityId: params.orderId,
        subjectOverride: isRenewal
          ? `Продление оплачено — ${brand}`
          : `Оплата получена — ${brand}`,
      });
    }
  } catch (err) {
    console.error(
      "[order-paid] notification failed:",
      err instanceof Error ? err.message : "unknown",
      params.orderId.slice(0, 8),
    );
  }
}

/** Ссылка на чат поддержки для писем (если понадобится отдельно). */
export function buildSupportChatUrl(siteSlug: SiteSlug, sessionId?: string): string {
  if (sessionId) return buildCustomerChatUrl(siteSlug, sessionId);
  const base = getSiteBySlug(siteSlug);
  return siteSlug === "subs-store"
    ? `${base.dashboardPath}&tab=chat`
    : `${base.dashboardPath}/chat`;
}
