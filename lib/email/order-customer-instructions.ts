import type { SiteSlug } from "@/lib/sites";

const STATUS_RU: Record<string, string> = {
  pending: "Ожидает оплаты",
  paid: "Оплачен",
  activating: "В активации",
  active: "Активирован",
  failed: "Ошибка",
  refunded: "Возврат",
  waiting_client: "Ждём данные от клиента",
  expired: "Истёк",
  processing: "В обработке",
  awaiting_payment: "Ожидает оплаты",
  activated: "Активирован",
  completed: "Завершён",
  problem: "Проблема",
};

export function orderStatusLabelRu(status: string): string {
  return STATUS_RU[status] ?? status;
}

/** Текст «что делать дальше» для писем и страницы заказа. */
export function getOrderCustomerInstructionLines(
  siteSlug: SiteSlug,
  status: string,
  context: "created" | "updated" | "paid",
): string[] {
  const isSubs = siteSlug === "subs-store";
  const s = status.trim().toLowerCase();

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

  if (s === "paid" || s === "activating" || s === "processing") {
    return [
      "Что делать дальше:",
      "1. Оплата получена — заказ уже в работе.",
      isSubs
        ? "2. Активация Spotify Premium обычно занимает 10–15 минут."
        : "2. Активация ChatGPT обычно занимает 5–15 минут.",
      "3. Следите за статусом на этой странице — обновляется без перезагрузки.",
    ];
  }

  if (s === "waiting_client" || s === "awaiting_data") {
    return [
      "Что делать дальше:",
      isSubs
        ? "1. Откройте чат поддержки на сайте — оператор напишет, какие данные нужны для Spotify."
        : "1. Откройте чат поддержки на сайте — оператор попросит токен или данные для ChatGPT.",
      "2. Ответьте в чате — после этого продолжим активацию.",
    ];
  }

  if (s === "active" || s === "activated" || s === "completed") {
    return [
      "Подписка активирована.",
      isSubs
        ? "Можете пользоваться Spotify Premium. Если возникнут вопросы — напишите в чат поддержки."
        : "Можете пользоваться ChatGPT. Если возникнут вопросы — напишите в чат поддержки.",
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
