const MOSCOW_TZ = "Europe/Moscow";

export type PromoDeadline = {
  year: number;
  month: number;
  day: number;
};

function moscowDateParts(date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MOSCOW_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

/** Календарные дни от «сегодня» (МСК) до deadline включительно. На deadline = 0. После — отрицательное. */
export function getDaysUntilPromoDeadline(deadline: PromoDeadline, now = new Date()): number {
  const today = moscowDateParts(now);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  const deadlineUtc = Date.UTC(deadline.year, deadline.month - 1, deadline.day);
  return Math.round((deadlineUtc - todayUtc) / 86_400_000);
}

export function isPromoDeadlineActive(deadline: PromoDeadline, now = new Date()): boolean {
  return getDaysUntilPromoDeadline(deadline, now) >= 0;
}

export function formatPromoDeadlineLabel(deadline: PromoDeadline): string {
  const months = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ];
  const monthLabel = months[deadline.month - 1] ?? "июня";
  return `${deadline.day} ${monthLabel}`;
}

export function pluralDaysRu(count: number): string {
  const n = Math.abs(count);
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${n} дней`;
  if (mod10 === 1) return `${n} день`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} дня`;
  return `${n} дней`;
}

export function promoDaysLeftLabel(daysLeft: number, deadlineLabel: string): string {
  if (daysLeft <= 0) return `Последний день — до ${deadlineLabel}`;
  return `Осталось ${pluralDaysRu(daysLeft)} — до ${deadlineLabel}`;
}
