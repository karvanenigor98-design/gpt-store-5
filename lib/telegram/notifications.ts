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
import { enqueueTelegramNotification } from "@/lib/notifications/outbox";
import { orderStatusLabelRu as unifiedOrderStatusLabelRu } from "@/lib/orders/order-status-labels";
import type { SiteSlug } from "@/lib/sites";
import { createAdminClient } from "@/lib/supabase/server";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Primary + optional comma-separated extra chats (admin / operators / group). */
function resolveTelegramChatIds(): string[] {
  const raw = [
    process.env.TELEGRAM_ADMIN_CHAT_ID,
    process.env.TELEGRAM_ADMIN_CHAT_IDS,
    process.env.TELEGRAM_OPERATOR_CHAT_ID,
    process.env.TELEGRAM_OPERATOR_CHAT_IDS,
  ]
    .flatMap((value) => (value ?? "").split(","))
    .map((x) => x.trim())
    .filter(Boolean);
  return Array.from(new Set(raw));
}

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

async function sendTelegramMessage(
  chatId: string,
  text: string,
  opts?: { siteSlug?: SiteSlug; eventType?: string; dedupeKey?: string },
) {
  if (!chatId || !text) return;

  const siteSlug = opts?.siteSlug ?? "gpt-store";
  const eventType = opts?.eventType ?? "telegram_alert";
  const dedupeKey =
    opts?.dedupeKey ??
    `${eventType}:${siteSlug}:${text.length}:${text.slice(0, 64).replace(/\s+/g, " ")}`;

  const queued = await enqueueTelegramNotification({
    siteSlug,
    eventType,
    chatId,
    text,
    dedupeKey,
  });
  if (queued.queued) return;

  // Fallback until outbox table exists in production.
  if (!BOT_TOKEN) return;
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
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("[Telegram] Ошибка отправки:", await res.text());
    }
  } catch (err) {
    console.error("[Telegram] Сетевая ошибка:", err);
  }
}

async function broadcastTelegram(
  text: string,
  opts?: { siteSlug?: SiteSlug; eventType?: string; dedupeKey?: string },
): Promise<void> {
  const chats = resolveTelegramChatIds();
  if (!chats.length) {
    console.warn("[Telegram] нет TELEGRAM_ADMIN_CHAT_ID / TELEGRAM_*_CHAT_IDS");
    return;
  }
  await Promise.all(
    chats.map((chatId) =>
      sendTelegramMessage(chatId, text, {
        ...opts,
        dedupeKey: opts?.dedupeKey
          ? `${opts.dedupeKey}:chat:${chatId}`
          : undefined,
      }),
    ),
  );
}

async function hasRecentNewOrderNotification(
  orderId: string,
  withinMinutes = 10,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const cutoff = new Date(Date.now() - withinMinutes * 60_000).toISOString();
    const { count } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("type", "new_order")
      .eq("entity_type", "order")
      .eq("entity_id", orderId)
      .gte("created_at", cutoff)
      .limit(1);
    return (count ?? 0) > 0;
  } catch {
    return false;
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
  await broadcastTelegram(text, { eventType: "new_user", dedupeKey: `new_user:${user.id ?? user.email ?? "x"}` });
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
  if (await hasRecentNewOrderNotification(order.id)) {
    return;
  }
  const brand = siteSlug === "subs-store" ? "SPOTIFY STORE" : "GPT STORE";
  const accountLabel = siteSlug === "subs-store" ? "Spotify" : "ChatGPT";
  const orderUrl = `${APP_URL}/admin/orders?site=${siteSlug}&highlight=${order.id}`;
  const text = `🔔 <b>Новый заказ</b>
🏪 Магазин: ${brand}
📋 Заказ: <code>${order.id}</code>
🛒 Тариф: ${order.plan_name ?? "не указан"}
💰 Сумма: ${order.price} ₽
📊 Статус: <b>Ожидает оплаты</b>
📧 Клиент: ${user.email ?? "неизвестен"}
📧 ${accountLabel}: ${order.account_email ?? "не указан"}
🔗 <a href="${orderUrl}">Открыть заказ</a>`;
  await broadcastTelegram(text, {
    siteSlug,
    eventType: "new_order",
    dedupeKey: `new_order:${order.id}`,
  });
  const { recordGptStaffEvent } = await import("@/lib/notifications/staff-events");
  await recordGptStaffEvent({
    type: "new_order",
    title: "🔔 Новый заказ",
    message: `${order.plan_name ?? order.id} · ${order.price} ₽ · ${user.email ?? "клиент"}`,
    siteSlug,
    entity_type: "order",
    entity_id: order.id,
    emailSubject: `🔔 Новый заказ — ${brand}`,
    emailBody: `Новый заказ (${brand})\nЗаказ: ${order.id}\nТариф: ${order.plan_name ?? order.id}\nСумма: ${order.price} ₽\nКлиент: ${user.email ?? "неизвестен"}\nАккаунт: ${order.account_email ?? "не указан"}\nОткрыть: ${orderUrl}`,
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

  const siteSlug: "gpt-store" | "subs-store" =
    options?.siteSlug === "subs-store" ? "subs-store" : "gpt-store";
  const label = unifiedOrderStatusLabelRu(siteSlug, status);
  const title = telegramTitleForStatus(status);

  const text = `${emoji} <b>${title}</b>
🏪 Магазин: ${siteSlug === "subs-store" ? "Spotify STORE" : "GPT STORE"}
📋 Заказ: <code>${order.id}</code>
🛒 Тариф: ${order.plan_name ?? "неизвестен"}
💰 Сумма: ${order.price} ₽
📊 Статус: <b>${label}</b>
📧 Email: ${order.account_email ?? "не указан"}
🔗 <a href="${APP_URL}/admin/orders?site=${siteSlug}&highlight=${order.id}">Открыть заказ</a>`;
  void broadcastTelegram(text, {
    siteSlug,
    eventType: `payment_${status}`,
    dedupeKey: `payment:${order.id}:${status}`,
  }).catch(() => undefined);

  const paidLike = status === "paid" || status === "activating";
  if (options?.skipStaffInAppAndEmail && paidLike) {
    return;
  }

  const notifType =
    status === "failed" ? "payment_failed" : paidLike ? "payment_success" : "order_problem";
  const { recordGptStaffEvent } = await import("@/lib/notifications/staff-events");
  await recordGptStaffEvent({
    type: notifType,
    title: `${title}`,
    message: `Заказ ${order.id} · ${label} · ${order.price} ₽`,
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
  siteSlug?: SiteSlug;
}) {
  const store =
    params.siteSlug === "subs-store" ? "Spotify STORE" : "GPT STORE";
  const text = `🔔 <b>Клиент написал — ${store}</b>
👤 Клиент: ${params.clientEmail ?? "неизвестен"}
💬 "${params.messagePreview.slice(0, 100)}${params.messagePreview.length > 100 ? "..." : ""}"
🔗 <a href="${params.chatHref}">Ответить</a>`;
  const siteSlug = params.siteSlug === "subs-store" ? "subs-store" : "gpt-store";
  const sessionHint =
    params.chatHref.match(/(?:thread_id|session_id)=([^&]+)/)?.[1] ?? "x";
  void broadcastTelegram(text, {
    siteSlug,
    eventType: "client_chat_message",
    dedupeKey: `client_chat:${siteSlug}:${sessionHint}:${params.messagePreview.slice(0, 80)}`,
  }).catch(() => undefined);
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
  // Operators use /operator/reviews; admins can open either.
  const adminHref = `${APP_URL}/operator/reviews?status=pending&site=${site}`;
  const text = `⭐ <b>Новый отзыв на модерации</b>
👤 Автор: ${review.author_name ?? "Аноним"}
💬 "${review.content.slice(0, 150)}..."
🔗 <a href="${adminHref}">Модерировать</a>`;
  void broadcastTelegram(text, {
    siteSlug: site,
    eventType: "new_review",
    dedupeKey: review.reviewId ? `review:${review.reviewId}` : undefined,
  }).catch(() => undefined);
  const { recordGptStaffNotification, recordSubsStaffNotification } = await import(
    "@/lib/notifications/staff-events"
  );
  await recordGptStaffNotification({
    type: "new_review",
    title: site === "subs-store" ? "⭐ Новый отзыв — SPOTIFY STORE" : "⭐ Новый отзыв",
    message: `${review.author_name ?? "Клиент"}: ${review.content.slice(0, 180)}`,
    siteSlug: site,
    entity_type: "review",
    entity_id: review.reviewId ?? null,
  });
  if (site === "subs-store") {
    await recordSubsStaffNotification({
      type: "new_review",
      title: "SPOTIFY STORE: новый отзыв на модерации",
      message: `${review.author_name ?? "Клиент"}: ${review.content.slice(0, 180)}`,
      entity_type: "review",
      entity_id: review.reviewId ?? null,
      sendEmail: false,
    });
  }
  // Email всем admin/operator с доступом к сайту (CTA → /operator/reviews).
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
  await broadcastTelegram(text, {
    eventType: "delayed_session",
    dedupeKey: `delayed:${sessionId}:${delayMinutes}`,
  });
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
  void broadcastTelegram(text, {
    siteSlug,
    eventType: "operational_failure",
    dedupeKey: `ops:${siteSlug}:${payload.context.slice(0, 80)}`,
  }).catch(() => undefined);
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
  const labelPrev = unifiedOrderStatusLabelRu("gpt-store", order.prev);
  const labelNext = unifiedOrderStatusLabelRu("gpt-store", order.next);
  const plan = order.plan_name ?? order.plan_id ?? "—";
  const text = `🔔 <b>Статус заказа изменён вручную</b>
📋 Заказ: <code>${order.id}</code>
🛒 Тариф: ${plan}
💰 Сумма: ${order.price} ₽
↔️ ${labelPrev} → <b>${labelNext}</b>
📧 ChatGPT: ${order.account_email ?? "не указан"}
🔗 <a href="${APP_URL}/admin/orders?highlight=${order.id}">Открыть</a>`;
  await broadcastTelegram(text, {
    eventType: "manual_order_status",
    dedupeKey: `manual_status:${order.id}:${order.prev}:${order.next}`,
  });
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
  await broadcastTelegram(text, {
    eventType: "daily_digest",
    dedupeKey: `daily_digest:${stats.dateLabel}`,
  });
  await notifyStaffEmails(
    `Сводка GPT STORE за ${stats.dateLabel}`,
    `Заказов сегодня: ${stats.ordersToday}\nВыручка сегодня: ${stats.revenueToday} ₽\nНовых клиентов: ${stats.newClientsToday}\nВыручка 7 дней: ${stats.revenue7d} ₽\nВыручка месяца: ${stats.revenueMonth} ₽\n${APP_URL}/admin`,
  );
}
