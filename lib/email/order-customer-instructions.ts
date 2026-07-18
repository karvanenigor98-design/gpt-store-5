import type { SiteSlug } from "@/lib/sites";
import { coerceOrderStatus } from "@/lib/dashboard/order-status-tracker";

const STATUS_RU: Record<string, string> = {
  pending: "Ожидает оплаты",
  paid: "Оплата получена",
  activating: "Активация подписки",
  active: "Активировано",
  failed: "Ошибка",
  refunded: "Возврат выполнен",
  waiting_client: "Ожидаем данные",
  expired: "Истёк",
  processing: "В обработке",
  awaiting_payment: "Ожидает оплаты",
  activated: "Активировано",
  completed: "Активировано",
  problem: "Проблема",
};

export function orderStatusLabelRu(status: string | null | undefined): string {
  const s = coerceOrderStatus(status);
  return STATUS_RU[s] ?? "Неизвестный статус";
}

/** Текст «что делать дальше» для писем и страницы заказа. */
export function getOrderCustomerInstructionLines(
  siteSlug: SiteSlug,
  status: string | null | undefined,
  context: "created" | "updated" | "paid",
): string[] {
  const isSubs = siteSlug === "subs-store";
  const s = coerceOrderStatus(status);

  if (context === "created" || s === "pending" || s === "awaiting_payment") {
    return [
      "Что делать дальше:",
      "1. Завершите оплату заказа (если ещё не оплатили).",
      "2. Статус обновится автоматически на странице заказа.",
      isSubs
        ? "3. При необходимости мы напишем в чат поддержки на сайте Spotify STORE."
        : "3. При необходимости мы напишем в чат поддержки на сайте GPT STORE.",
    ];
  }

  if (s === "paid") {
    return [
      "Статус заказа: Оплата получена",
      "1. Платёж подтверждён.",
      "2. При необходимости специалист свяжется с вами для уточнения данных.",
      "3. Следите за этапами на этой странице — обновляется автоматически.",
    ];
  }

  if (s === "activating" || s === "processing") {
    return [
      "Статус заказа: Активация подписки",
      isSubs
        ? "1. Подключаем Spotify Premium к вашему аккаунту (обычно 10–15 минут)."
        : "1. Подключаем подписку ChatGPT к вашему аккаунту (обычно 5–15 минут).",
      "2. Следите за прогрессом на этой странице.",
    ];
  }

  if (s === "waiting_client" || s === "awaiting_data") {
    return [
      "Статус заказа: Ожидаем данные",
      "1. Специалист свяжется с вами для получения данных, необходимых для активации.",
      isSubs
        ? "2. Можете написать в чат поддержки на сайте Spotify STORE."
        : "2. Можете написать в чат поддержки на сайте GPT STORE.",
    ];
  }

  if (s === "active" || s === "activated" || s === "completed") {
    return [
      "Статус заказа: Активировано",
      "1. Подписка успешно подключена.",
      isSubs
        ? "2. Можете пользоваться Spotify Premium. Вопросы — в чат поддержки."
        : "2. Можете пользоваться ChatGPT. Вопросы — в чат поддержки.",
    ];
  }

  if (s === "failed" || s === "problem") {
    return [
      "С заказом возникла проблема.",
      "Напишите в чат поддержки на сайте — оператор поможет завершить активацию или оформить возврат.",
    ];
  }

  if (s === "expired" || s === "refunded") {
    return [
      "Заказ закрыт.",
      isSubs
        ? "Можете оформить новый заказ на лендинге Spotify STORE."
        : "Можете оформить новый заказ на лендинге GPT STORE.",
    ];
  }

  return [
    "Откройте страницу заказа в личном кабинете — там актуальный статус и подсказки.",
  ];
}
