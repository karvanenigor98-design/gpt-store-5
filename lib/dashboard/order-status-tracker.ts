/** Безопасная строка статуса (Realtime/БД могут отдать не string). */
export function coerceOrderStatus(status: unknown): string {
  if (status == null || status === "") return "pending";
  return String(status).trim().toLowerCase() || "pending";
}

/** Шаги прогресса в кабинете (после оплаты): оплата → данные → активация → готово. */
export type OrderTrackerStep =
  | "payment_received"
  | "awaiting_data"
  | "activation"
  | "activated";

const ACTIVATED = new Set(["active", "activated", "completed"]);

const ACTIVATION = new Set(["activating", "processing", "awaiting_operator"]);

const AWAITING_DATA = new Set(["waiting_client", "awaiting_data"]);

const PAYMENT_RECEIVED = new Set(["paid"]);

function normalizeStatus(status: string | null | undefined | unknown): string {
  return coerceOrderStatus(status);
}

/** Любой статус БД → шаг трекера (GPT + Spotify / subs). */
export function mapOrderStatusToTrackerStep(status: string | null | undefined): OrderTrackerStep {
  const s = normalizeStatus(status);
  if (ACTIVATED.has(s)) return "activated";
  if (ACTIVATION.has(s)) return "activation";
  if (AWAITING_DATA.has(s)) return "awaiting_data";
  if (PAYMENT_RECEIVED.has(s)) return "payment_received";
  // До оплаты или неизвестный — показываем первый шаг (оплата ещё не подтверждена)
  return "payment_received";
}

export function orderStatusForTracker(status: string | null | undefined): OrderTrackerStep {
  return mapOrderStatusToTrackerStep(status);
}

/** Показывать трекер только после оплаты (не на «ожидает оплаты»). */
export function shouldShowOrderStatusTracker(status: string | null | undefined): boolean {
  const s = normalizeStatus(status);
  if (["pending", "awaiting_payment", "new", "pending_payment_setup"].includes(s)) {
    return false;
  }
  return true;
}
