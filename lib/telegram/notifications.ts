import {
  emailCustomerOrderCreated,
  emailCustomerOrderUpdate,
  emailCustomerChatReply,
  emailStaffNewReview,
  emailStaffOrderProblem,
} from "@/lib/email/notify-hooks";
import { collectStaffEmailsForAllSites } from "@/lib/email/recipients";
import {
  notifyAdminEmailFailure,
  sendTransactionalEmailMany,
} from "@/lib/email/send-email";
import type { SiteSlug } from "@/lib/sites";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Один адрес для операционных писем: ADMIN_EMAIL → SUPPORT_NOTIFICATION_EMAIL → первый из ADMIN_EMAILS. */
export function resolveAdminNotificationEmail(): string | null {
  const primary = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (primary) return primary;
  if (process.env.SUPPORT_NOTIFICATION_EMAIL?.trim()) {
    return process.env.SUPPORT_NOTIFICATION_EMAIL.trim().toLowerCase();
  }
  const fromAdminList = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .find(Boolean);
  return fromAdminList ?? null;
}

export function resolveStaffNotificationEmails(): string[] {
  const candidates = [
    process.env.ADMIN_EMAIL,
    process.env.OPERATOR_EMAIL,
    process.env.SUPPORT_NOTIFICATION_EMAIL,
    ...(process.env.ADMIN_EMAILS ?? "").split(","),
    ...(process.env.OPERATOR_EMAILS ?? "").split(","),
  ]
    .map((x) => (x ?? "").trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(candidates));
}

async function sendEmailMany(to: string[], subject: string, text: string, html?: string) {
  if (!to.length) return;
  const results = await sendTransactionalEmailMany(to, subject, text, html);
  const failed = results.find((r) => !r.ok && !r.skipped);
  if (failed?.error) {
    void notifyAdminEmailFailure(subject, failed.error);
  }
}

/** Письма всем admin/operator (+ extra). */
export async function notifyStaffEmails(
  subject: string,
  text: string,
  extraEmails?: string[],
): Promise<void> {
  const fromProfiles = await collectStaffEmailsForAllSites();
  const recipients = Array.from(
    new Set(
      [...resolveStaffNotificationEmails(), ...fromProfiles, ...(extraEmails ?? [])]
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  if (!recipients.length) {
    console.warn("[Email] notifyStaffEmails: нет получателей (ADMIN_EMAIL / profiles admin|operator)");
    return;
  }
  await sendEmailMany(recipients, subject, text);
}

async function sendTelegramMessage(chatId: string, text: string) {
  if (!BOT_TOKEN || !chatId) return;
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      console.error("[Telegram] Ошибка отправки:", await res.text());
    }
  } catch (err) {
    console.error("[Telegram] Сетевая ошибка:", err);
  }
}

export async function notifyNewUser(user: {
  id?: string;
  username?: string | null;
  email?: string | null;
  telegram_username?: string | null;
}) {
  const text = `🆕 <b>Новый пользователь</b>
📧 Email: ${user.email ?? "не указан"}
📱 Telegram: ${user.telegram_username ? "@" + user.telegram_username : "нет"}
🔗 <a href="${APP_URL}/admin/users">Открыть в админке</a>`;
  await sendTelegramMessage(ADMIN_CHAT_ID, text);
  await notifyStaffEmails(
    "Новый пользователь — GPT STORE",
    `Новый пользователь\nEmail: ${user.email ?? "не указан"}\nTelegram: ${user.telegram_username ? "@" + user.telegram_username : "нет"}\nОткрыть: ${APP_URL}/admin/users`,
  );
}

export async function notifyNewOrder(
  order: {
    id: string;
    plan_name?: string | null;
    price: number;
    account_email?: string | null;
    product?: string | null;
  },
  user: { email?: string | null },
  options?: { siteSlug?: "gpt-store" | "subs-store" },
) {
  const siteSlug: "gpt-store" | "subs-store" =
    options?.siteSlug ??
    (order.product?.toLowerCase().includes("spotify") ? "subs-store" : "gpt-store");
  const brand = siteSlug === "subs-store" ? "SPOTIFY STORE" : "GPT STORE";
  const text = `🔔 <b>Новый заказ</b>
🛒 Тариф: ${order.plan_name ?? order.id}
💰 Сумма: ${order.price} ₽
📧 Клиент: ${user.email ?? "неизвестен"}
📧 ChatGPT: ${order.account_email ?? "не указан"}
🔗 <a href="${APP_URL}/admin/orders">Открыть заказ</a>`;
  await sendTelegramMessage(ADMIN_CHAT_ID, text);
  const { recordGptStaffEvent } = await import("@/lib/notifications/staff-events");
  await recordGptStaffEvent({
    type: "new_order",
    title: "🔔 Новый заказ",
    message: `${order.plan_name ?? order.id} · ${order.price} ₽ · ${user.email ?? "клиент"}`,
    siteSlug,
    entity_type: "order",
    entity_id: order.id,
    emailSubject: `🔔 Новый заказ — ${brand}`,
    emailBody: `Новый заказ (${brand})\nТариф: ${order.plan_name ?? order.id}\nСумма: ${order.price} ₽\nКлиент: ${user.email ?? "неизвестен"}\nАккаунт: ${order.account_email ?? "не указан"}\nОткрыть: ${APP_URL}/admin/orders?site=${siteSlug}`,
  });
}

export async function notifyCustomerOrderCreated(payload: {
  customerEmail: string;
  orderId: string;
  planName: string;
  price: number;
  accountEmail?: string;
  siteSlug?: SiteSlug;
  customerUserId?: string | null;
}) {
  const siteSlug: SiteSlug = payload.siteSlug ?? "gpt-store";
  await emailCustomerOrderCreated({
    siteSlug,
    customerEmail: payload.customerEmail,
    customerUserId: payload.customerUserId,
    orderId: payload.orderId,
    planName: payload.planName,
    price: payload.price,
  });
}

const STATUS_NAMES: Record<string, string> = {
  paid: "Оплачен",
  activating: "В активации",
  active: "Активирован",
  failed: "Ошибка",
  refunded: "Возврат",
  waiting_client: "Ждём данные от клиента",
  pending: "Ожидает оплаты",
  expired: "Истёк",
};

function telegramTitleForStatus(status: string): string {
  if (status === "activating" || status === "paid") return "🔔 Оплата пришла";
  if (status === "active") return "🟢 Подписка активирована";
  if (status === "failed") return "❌ Ошибка оплаты / заказа";
  return "📋 Статус заказа";
}

export async function notifyPaymentStatus(
  order: { id: string; plan_name?: string | null; price: number; account_email?: string | null },
  status: string,
  options?: { siteSlug?: SiteSlug; skipStaffInAppAndEmail?: boolean },
) {
  const emoji =
    {
      paid: "✅",
      activating: "✅",
      active: "🟢",
      failed: "❌",
      refunded: "↩️",
      waiting_client: "⏳",
    }[status] ?? "📋";

  const label = STATUS_NAMES[status] ?? status;
  const title = telegramTitleForStatus(status);

  const text = `${emoji} <b>${title}</b>
📋 Заказ: ${order.id.slice(0, 8)}...
🛒 Тариф: ${order.plan_name ?? "неизвестен"}
💰 Сумма: ${order.price} ₽
📊 Статус: <b>${label}</b>
📧 ChatGPT: ${order.account_email ?? "не указан"}
🔗 <a href="${APP_URL}/admin/orders">Открыть в админке</a>`;
  await sendTelegramMessage(ADMIN_CHAT_ID, text);

  const paidLike = status === "paid" || status === "activating";
  if (options?.skipStaffInAppAndEmail && paidLike) {
    return;
  }

  const siteSlug = (options?.siteSlug ?? "gpt-store") as "gpt-store" | "subs-store";
  const notifType =
    status === "failed" ? "payment_failed" : paidLike ? "payment_success" : "order_problem";
  const { recordGptStaffEvent } = await import("@/lib/notifications/staff-events");
  await recordGptStaffEvent({
    type: notifType,
    title: `${title}`,
    message: `Заказ ${order.id.slice(0, 8)}… · ${label} · ${order.price} ₽`,
    siteSlug,
    entity_type: "order",
    entity_id: order.id,
    emailSubject: `${title} — ${label}`,
    emailBody: `Заказ: ${order.id}\nТариф: ${order.plan_name ?? "неизвестен"}\nСумма: ${order.price} ₽\nСтатус: ${label}\nОткрыть: ${APP_URL}/admin/orders?site=${siteSlug}&highlight=${order.id}`,
  });
}

export async function notifyCustomerOrderStatus(payload: {
  customerEmail: string;
  orderId: string;
  planName?: string;
  status: string;
  price: number;
  siteSlug?: SiteSlug;
  customerUserId?: string | null;
}) {
  const siteSlug: SiteSlug = payload.siteSlug ?? "gpt-store";
  await emailCustomerOrderUpdate({
    siteSlug,
    customerEmail: payload.customerEmail,
    customerUserId: payload.customerUserId,
    orderId: payload.orderId,
    planName: payload.planName ?? (siteSlug === "subs-store" ? "Spotify Premium" : "Подписка ChatGPT"),
    status: payload.status,
    price: payload.price,
  });
}

/** Telegram-only (DB/email — через alertStaffOnClientSupportMessage). */
export async function sendTelegramStaffChatAlert(params: {
  clientEmail: string | null;
  messagePreview: string;
  chatHref: string;
}) {
  const text = `🔔 <b>Клиент написал</b>
👤 Клиент: ${params.clientEmail ?? "неизвестен"}
💬 "${params.messagePreview.slice(0, 100)}${params.messagePreview.length > 100 ? "..." : ""}"
🔗 <a href="${params.chatHref}">Ответить</a>`;
  await sendTelegramMessage(ADMIN_CHAT_ID, text);
}

/** @deprecated Используйте alertStaffOnClientSupportMessage */
export async function notifyNewMessage(
  sessionId: string,
  userEmail: string | null,
  messagePreview: string
) {
  const { alertStaffOnClientSupportMessage } = await import("@/lib/notifications/client-chat-alert");
  await alertStaffOnClientSupportMessage({
    siteSlug: "gpt-store",
    sessionId,
    clientUserId: null,
    clientEmail: userEmail,
    messagePreview,
  });
}

export async function notifyStaffAboutChatMessage(payload: {
  fromEmail: string | null;
  messagePreview: string;
  sessionId: string;
  recipients?: string[];
  siteSlug?: "gpt-store" | "subs-store";
}) {
  const preview =
    payload.messagePreview.length > 200
      ? `${payload.messagePreview.slice(0, 200)}...`
      : payload.messagePreview;

  const site = payload.siteSlug ?? "gpt-store";
  const brand = site === "subs-store" ? "Subs Store" : "GPT STORE";
  const subject = `💬 Сообщение от клиента — ${brand}`;
  const text = `Поступило новое сообщение от клиента.

Отправитель: ${payload.fromEmail ?? "неизвестен"}
Сессия: ${payload.sessionId}
Сообщение: ${preview}

Открыть чат: ${APP_URL}/admin/chat?site=${site}`;

  const { recordGptStaffEvent, recordSubsStaffNotification } = await import(
    "@/lib/notifications/staff-events"
  );

  if (site === "subs-store") {
    await recordSubsStaffNotification({
      type: "new_chat_message",
      title: `Subs Store: сообщение клиента`,
      message: `${payload.fromEmail ?? "клиент"}: ${preview}`,
      entity_type: "chat_session",
      entity_id: payload.sessionId,
      emailSubject: subject,
      emailBody: text,
    });
  } else {
    await recordGptStaffEvent({
      type: "new_chat_message",
      title: "💬 Клиент написал",
      message: `${payload.fromEmail ?? "клиент"}: ${preview}`,
      entity_type: "chat_session",
      entity_id: payload.sessionId,
      siteSlug: "gpt-store",
      emailSubject: subject,
      emailBody: text,
    });
  }
}

export async function notifyCustomerAboutChatMessage(payload: {
  customerEmail: string;
  customerUserId?: string | null;
  senderRoleLabel: string;
  messagePreview: string;
  sessionId: string;
  siteSlug?: SiteSlug;
}) {
  const siteSlug: SiteSlug = payload.siteSlug ?? "gpt-store";
  const userId = payload.customerUserId ?? payload.customerEmail;
  await emailCustomerChatReply({
    siteSlug,
    customerUserId: userId,
    customerEmail: payload.customerEmail,
    sessionId: payload.sessionId,
    senderLabel: payload.senderRoleLabel,
    messagePreview: payload.messagePreview,
  });
}

export async function notifyNewReview(review: {
  author_name?: string | null;
  content: string;
  siteSlug?: "gpt-store" | "subs-store";
  reviewId?: string;
}) {
  const site = review.siteSlug ?? "gpt-store";
  const adminHref = `${APP_URL}/admin/reviews?status=pending&site=${site}`;
  const text = `⭐ <b>Новый отзыв на модерации</b>
👤 Автор: ${review.author_name ?? "Аноним"}
💬 "${review.content.slice(0, 150)}..."
🔗 <a href="${adminHref}">Модерировать</a>`;
  await sendTelegramMessage(ADMIN_CHAT_ID, text);
  const { recordGptStaffNotification } = await import("@/lib/notifications/staff-events");
  await recordGptStaffNotification({
    type: "new_review",
    title: site === "subs-store" ? "⭐ Новый отзыв — Subs Store" : "⭐ Новый отзыв",
    message: `${review.author_name ?? "Клиент"}: ${review.content.slice(0, 180)}`,
    siteSlug: site,
    entity_type: "review",
    entity_id: review.reviewId ?? null,
  });
  await emailStaffNewReview({
    siteSlug: site,
    authorName: review.author_name ?? null,
    content: review.content,
    reviewId: review.reviewId,
  });
}

export async function notifyDelayedSession(sessionId: string, delayMinutes: number) {
  const text = `🚨 <b>Нет ответа оператора</b>
📋 Сессия: ${sessionId}
⏱ Ожидание: ${delayMinutes} мин
🔗 <a href="${APP_URL}/admin/chat">Открыть чат</a>`;
  await sendTelegramMessage(ADMIN_CHAT_ID, text);
  const { recordGptStaffEvent } = await import("@/lib/notifications/staff-events");
  await recordGptStaffEvent({
    type: "order_problem",
    title: "Нет ответа оператора",
    message: `Сессия ${sessionId} · ${delayMinutes} мин`,
    entity_type: "chat_session",
    entity_id: sessionId,
    emailSubject: "Нет ответа оператора",
    emailBody: `Сессия без ответа оператора\nСессия: ${sessionId}\nОжидание: ${delayMinutes} мин\nОткрыть: ${APP_URL}/admin/chat`,
  });
}

/** Ошибки оплаты / обработки заказа (без чувствительных данных в тексте). */
export async function notifyOperationalFailure(payload: {
  context: string;
  detail?: string;
  siteSlug?: "gpt-store" | "subs-store";
}) {
  const siteSlug: "gpt-store" | "subs-store" = payload.siteSlug ?? "gpt-store";
  const safeDetail = payload.detail ? payload.detail.slice(0, 500) : "";
  const text = `⚠️ <b>Ошибка в работе сервиса</b>
📌 ${payload.context}
${safeDetail ? `\n<i>${safeDetail.replace(/</g, "")}</i>` : ""}
🔗 <a href="${APP_URL}/admin/orders">Админка</a>`;
  void sendTelegramMessage(ADMIN_CHAT_ID, text);
  void import("@/lib/notifications/staff-events").then(({ recordGptStaffNotification }) =>
    recordGptStaffNotification({
      type: "order_problem",
      title: `⚠️ ${payload.context}`,
      message: safeDetail || payload.context,
      siteSlug,
    }),
  );
  void emailStaffOrderProblem({
    siteSlug,
    title: `Ошибка: ${payload.context}`,
    message: safeDetail || payload.context,
  });
}

/** Смена статуса заказа вручную из админки. */
export async function notifyManualOrderStatusChange(order: {
  id: string;
  plan_name?: string | null;
  plan_id?: string;
  price: number;
  account_email?: string | null;
  prev: string;
  next: string;
}) {
  const labelPrev = STATUS_NAMES[order.prev] ?? order.prev;
  const labelNext = STATUS_NAMES[order.next] ?? order.next;
  const plan = order.plan_name ?? order.plan_id ?? "—";
  const text = `🔔 <b>Статус заказа изменён вручную</b>
📋 Заказ: ${order.id.slice(0, 8)}...
🛒 Тариф: ${plan}
💰 Сумма: ${order.price} ₽
↔️ ${labelPrev} → <b>${labelNext}</b>
📧 ChatGPT: ${order.account_email ?? "не указан"}
🔗 <a href="${APP_URL}/admin/orders">Открыть</a>`;
  await sendTelegramMessage(ADMIN_CHAT_ID, text);
  const { recordGptStaffEvent } = await import("@/lib/notifications/staff-events");
  await recordGptStaffEvent({
    type: "order_problem",
    title: "Статус заказа изменён",
    message: `${labelPrev} → ${labelNext}`,
    entity_type: "order",
    entity_id: order.id,
    emailSubject: `Статус заказа вручную: ${labelNext}`,
    emailBody: `Заказ: ${order.id}\nТариф: ${plan}\nБыло: ${labelPrev}\nСтало: ${labelNext}\n${APP_URL}/admin/orders`,
  });
}

export async function notifyDailyAdminDigest(stats: {
  dateLabel: string;
  ordersToday: number;
  revenueToday: number;
  newClientsToday: number;
  revenue7d: number;
  revenueMonth: number;
}) {
  const text = `📊 <b>Итоги дня (${stats.dateLabel})</b>
🛒 Заказов сегодня: ${stats.ordersToday}
💰 Выручка сегодня: ${stats.revenueToday.toLocaleString("ru")} ₽
👤 Новых клиентов: ${stats.newClientsToday}
📈 Выручка 7 дней: ${stats.revenue7d.toLocaleString("ru")} ₽
📆 Выручка месяца: ${stats.revenueMonth.toLocaleString("ru")} ₽
🔗 <a href="${APP_URL}/admin">Панель</a>`;
  await sendTelegramMessage(ADMIN_CHAT_ID, text);
  await notifyStaffEmails(
    `Сводка GPT STORE за ${stats.dateLabel}`,
    `Заказов сегодня: ${stats.ordersToday}\nВыручка сегодня: ${stats.revenueToday} ₽\nНовых клиентов: ${stats.newClientsToday}\nВыручка 7 дней: ${stats.revenue7d} ₽\nВыручка месяца: ${stats.revenueMonth} ₽\n${APP_URL}/admin`,
  );
}
