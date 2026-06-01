/**
 * Высокоуровневые email-хуки — вызывать после создания in-app notification.
 */

import type { SiteSlug } from "@/lib/sites";

import { dispatchSiteEmail, dispatchStaffSiteEmails } from "@/lib/email/dispatch";
import type { EmailEventType } from "@/lib/email/events";
import { resolveCustomerEmailFromGptProfile } from "@/lib/email/recipients";
import {
  buildCustomerChatUrl,
  buildCustomerOrderUrl,
  buildReviewUrl,
  buildStaffChatUrl,
  buildStaffOrderUrl,
  resolveAppBaseUrl,
} from "@/lib/email/site-urls";
import {
  getOrderCustomerInstructionLines,
  orderStatusLabelRu,
} from "@/lib/email/order-customer-instructions";

export async function emailCustomerChatReply(params: {
  siteSlug: SiteSlug;
  customerUserId: string;
  customerEmail?: string | null;
  sessionId: string;
  senderLabel: string;
  messagePreview: string;
}): Promise<void> {
  const email =
    params.customerEmail?.trim().toLowerCase() ||
    (await resolveCustomerEmailFromGptProfile(params.customerUserId));
  if (!email) return;

  const preview =
    params.messagePreview.length > 200
      ? `${params.messagePreview.slice(0, 200)}…`
      : params.messagePreview;

  const brandTitle =
    params.siteSlug === "subs-store" ?
      "Вам написали в поддержку SPOTIFY STORE"
    : "Вам написали в поддержку GPT STORE";
  const bodyIntro =
    params.siteSlug === "subs-store" ?
      "Оператор написал вам в чате по вашему аккаунту/заказу. Откройте личный кабинет, чтобы ответить."
    : "Оператор написал вам в чате по вашему аккаунту/заказу. Откройте личный кабинет, чтобы ответить.";

  await dispatchSiteEmail({
    siteSlug: params.siteSlug,
    eventType: "chat_staff_reply",
    recipientEmail: email,
    recipientRole: "client",
    recipientUserId: params.customerUserId,
    title: brandTitle,
    bodyLines: [bodyIntro, preview ? `«${preview}»` : ""].filter(Boolean),
    ctaLabel: "Открыть чат",
    ctaUrl: buildCustomerChatUrl(params.siteSlug, params.sessionId),
    dedupeKey: `chat_reply:${params.siteSlug}:${params.sessionId}:${params.customerUserId}`,
    relatedEntityType: params.siteSlug === "subs-store" ? "chat_thread" : "chat_session",
    relatedEntityId: params.sessionId,
  });
}

export async function emailStaffClientChatMessage(params: {
  siteSlug: SiteSlug;
  sessionId: string;
  clientEmail: string | null;
  messagePreview: string;
  excludeUserId?: string | null;
  excludeEmail?: string | null;
}): Promise<void> {
  const preview = (params.messagePreview || "—").slice(0, 400);
  const who = params.clientEmail?.trim() || "клиент";
  const brand = params.siteSlug === "subs-store" ? "SPOTIFY STORE" : "GPT STORE";

  await dispatchStaffSiteEmails({
    siteSlug: params.siteSlug,
    eventType: "chat_client_message",
    title: `Клиент написал в чат — ${brand}`,
    bodyLines: [`Клиент: ${who}`, preview],
    ctaLabel: "Открыть чат",
    ctaUrl: buildStaffChatUrl(params.siteSlug, params.sessionId),
    dedupeKey: `chat_client:${params.siteSlug}:${params.sessionId}`,
    relatedEntityType: params.siteSlug === "subs-store" ? "chat_thread" : "chat_session",
    relatedEntityId: params.sessionId,
    excludeUserId: params.excludeUserId,
    excludeEmail: params.excludeEmail,
  });
}

export async function emailCustomerOrderUpdate(params: {
  siteSlug: SiteSlug;
  customerEmail: string;
  customerUserId?: string | null;
  orderId: string;
  planName: string;
  status: string;
  price: number;
}): Promise<void> {
  const label = orderStatusLabelRu(params.status);
  const lines = [
    `Заказ: ${params.orderId.slice(0, 8)}…`,
    `Тариф: ${params.planName}`,
    `Сумма: ${params.price} ₽`,
    `Статус: ${label}`,
    ...getOrderCustomerInstructionLines(params.siteSlug, params.status, "updated"),
  ];

  let eventType: EmailEventType = "order_status_changed";
  if (params.status === "active" || params.status === "activated") {
    eventType = "subscription_activated";
  } else if (params.status === "expired") {
    eventType = "subscription_expired";
  } else if (params.status === "paid" || params.status === "activating") {
    eventType = "payment_received";
  } else if (params.status === "failed" || params.status === "problem") {
    eventType = "payment_failed";
  }

  const reviewCta =
    params.status === "active" || params.status === "activated"
      ? {
          ctaLabel: "Оставить отзыв" as const,
          ctaUrl: buildReviewUrl(params.siteSlug),
          extraLine: "Если всё понравилось, будем благодарны за отзыв.",
        }
      : {
          ctaLabel: "Статус заказа" as const,
          ctaUrl: buildCustomerOrderUrl(params.siteSlug, params.orderId),
          extraLine: null as string | null,
        };

  if (reviewCta.extraLine) lines.push(reviewCta.extraLine);

  await dispatchSiteEmail({
    siteSlug: params.siteSlug,
    eventType,
    recipientEmail: params.customerEmail,
    recipientRole: "client",
    recipientUserId: params.customerUserId,
    title:
      eventType === "subscription_activated"
        ? "Подписка активирована"
        : `Статус заказа: ${label}`,
    bodyLines: lines,
    ctaLabel: reviewCta.ctaLabel,
    ctaUrl: reviewCta.ctaUrl,
    dedupeKey: `order_status:${params.siteSlug}:${params.orderId}:${params.status}:${params.customerEmail}`,
    relatedEntityType: "order",
    relatedEntityId: params.orderId,
  });
}

export async function emailCustomerOrderCreated(params: {
  siteSlug: SiteSlug;
  customerEmail: string;
  customerUserId?: string | null;
  orderId: string;
  planName: string;
  price: number;
}): Promise<void> {
  await dispatchSiteEmail({
    siteSlug: params.siteSlug,
    eventType: "order_created",
    recipientEmail: params.customerEmail,
    recipientRole: "client",
    recipientUserId: params.customerUserId,
    title: "Заказ создан",
    bodyLines: [
      `Номер: ${params.orderId.slice(0, 8)}…`,
      `Тариф: ${params.planName}`,
      `Сумма: ${params.price} ₽`,
      `Статус: ${orderStatusLabelRu("pending")}`,
      ...getOrderCustomerInstructionLines(params.siteSlug, "pending", "created"),
    ],
    ctaLabel: "Статус заказа",
    ctaUrl: buildCustomerOrderUrl(params.siteSlug, params.orderId),
    dedupeKey: `order_created:${params.siteSlug}:${params.orderId}:${params.customerEmail}`,
    relatedEntityType: "order",
    relatedEntityId: params.orderId,
  });
}

export async function emailStaffNewOrder(params: {
  siteSlug: SiteSlug;
  orderId: string;
  planName: string;
  price: number;
  clientEmail: string | null;
}): Promise<void> {
  const brand = params.siteSlug === "subs-store" ? "SPOTIFY STORE" : "GPT STORE";
  await dispatchStaffSiteEmails({
    siteSlug: params.siteSlug,
    eventType: "staff_new_order",
    title: `Новый заказ — ${brand}`,
    bodyLines: [
      `Тариф: ${params.planName}`,
      `Сумма: ${params.price} ₽`,
      `Клиент: ${params.clientEmail ?? "неизвестен"}`,
    ],
    ctaLabel: "Открыть заказ",
    ctaUrl: buildStaffOrderUrl(params.siteSlug, params.orderId),
    dedupeKey: `staff_new_order:${params.siteSlug}:${params.orderId}`,
    relatedEntityType: "order",
    relatedEntityId: params.orderId,
  });
}

export async function emailStaffPromocodeUsed(params: {
  siteSlug: SiteSlug;
  code: string;
  orderId: string;
}): Promise<void> {
  const brand = params.siteSlug === "subs-store" ? "SPOTIFY STORE" : "GPT STORE";
  await dispatchStaffSiteEmails({
    siteSlug: params.siteSlug,
    eventType: "promocode_used",
    title: `Промокод использован — ${brand}`,
    bodyLines: [`Код: ${params.code}`, `Заказ: ${params.orderId.slice(0, 8)}…`],
    ctaLabel: "Открыть заказы",
    ctaUrl: buildStaffOrderUrl(params.siteSlug),
    dedupeKey: `promo:${params.siteSlug}:${params.orderId}:${params.code}`,
    relatedEntityType: "order",
    relatedEntityId: params.orderId,
  });
}

export async function emailStaffNewReview(params: {
  siteSlug: SiteSlug;
  authorName: string | null;
  content: string;
  reviewId?: string;
}): Promise<void> {
  const brand = params.siteSlug === "subs-store" ? "SPOTIFY STORE" : "GPT STORE";
  const app = resolveAppBaseUrl();
  await dispatchStaffSiteEmails({
    siteSlug: params.siteSlug,
    eventType: "new_review",
    title: `Новый отзыв — ${brand}`,
    bodyLines: [
      `Автор: ${params.authorName ?? "Клиент"}`,
      params.content.slice(0, 200),
    ],
    ctaLabel: "Модерация",
    ctaUrl: `${app}/admin/reviews?status=pending&site=${params.siteSlug}`,
    dedupeKey: `review:${params.siteSlug}:${params.reviewId ?? params.content.slice(0, 40)}`,
    relatedEntityType: "review",
    relatedEntityId: params.reviewId ?? null,
  });
}

export async function emailStaffOrderProblem(params: {
  siteSlug: SiteSlug;
  title: string;
  message: string;
  orderId?: string;
}): Promise<void> {
  await dispatchStaffSiteEmails({
    siteSlug: params.siteSlug,
    eventType: "order_problem",
    title: params.title,
    bodyLines: [params.message],
    ctaLabel: "Открыть заказы",
    ctaUrl: buildStaffOrderUrl(params.siteSlug, params.orderId),
    dedupeKey: `problem:${params.siteSlug}:${params.orderId ?? "x"}:${params.title}`,
    relatedEntityType: params.orderId ? "order" : null,
    relatedEntityId: params.orderId ?? null,
  });
}
