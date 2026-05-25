import type { PublicReview } from "@/lib/reviews/publicReviews";

const RU_MONTHS: Record<string, number> = {
  января: 1,
  февраля: 2,
  марта: 3,
  апреля: 4,
  мая: 5,
  июня: 6,
  июля: 7,
  августа: 8,
  сентября: 9,
  октября: 10,
  ноября: 11,
  декабря: 12,
};

const DISPLAY_FIRST_NAMES = [
  "Алексей",
  "Мария",
  "Дмитрий",
  "Екатерина",
  "Иван",
  "Анна",
  "Сергей",
  "Ольга",
  "Никита",
  "Виктория",
  "Павел",
  "Ксения",
  "Артём",
  "Елена",
  "Максим",
  "Валерия",
];

const DISPLAY_LAST_INITIALS = "АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ";

const BAD_AUTHOR_PATTERN =
  /^(deleted\s*account|удалённ|удаленн|unknown|неизвестн|account\s*deleted|anonymous)$/i;

const EMBEDDED_DATETIME_PATTERN =
  /\d{1,2}[./]\d{1,2}[./]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/;

/** Убирает emoji, variation selectors, ZWJ. */
export function stripEmojis(value: string): string {
  return value
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Имя в стиле «Алексей М.» — стабильно по seed (id / username). */
export function displayNameFromSeed(seed: string): string {
  const h = hashSeed(seed);
  const first = DISPLAY_FIRST_NAMES[h % DISPLAY_FIRST_NAMES.length]!;
  const last = DISPLAY_LAST_INITIALS[(h >> 4) % DISPLAY_LAST_INITIALS.length]!;
  return `${first} ${last}.`;
}

function looksLikeRealPersonName(name: string): boolean {
  const cleaned = stripEmojis(name).replace(EMBEDDED_DATETIME_PATTERN, "").replace(/\)\s*ru\s*$/i, "").trim();
  if (cleaned.length < 2 || cleaned.length > 48) return false;
  if (BAD_AUTHOR_PATTERN.test(cleaned)) return false;
  if (/^\d+$/.test(cleaned)) return false;
  if (EMBEDDED_DATETIME_PATTERN.test(cleaned)) return false;
  if (/[@#]/.test(cleaned)) return false;
  const letterCount = (cleaned.match(/\p{L}/gu) ?? []).length;
  if (letterCount < 2) return false;
  if (/^(gpt|subs|spotify|digital)/i.test(cleaned)) return false;
  return true;
}

function titleCaseWord(word: string): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function normalizePersonName(name: string): string {
  let n = stripEmojis(name)
    .replace(EMBEDDED_DATETIME_PATTERN, "")
    .replace(/\)\s*ru\s*$/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Клиент";
  if (parts.length === 1) return titleCaseWord(parts[0]!);
  const first = titleCaseWord(parts[0]!);
  const lastPart = parts[parts.length - 1]!;
  const lastInitial = lastPart.replace(/[^\p{L}]/gu, "").charAt(0);
  return lastInitial ? `${first} ${lastInitial.toUpperCase()}.` : first;
}

function usernameLooksDisplayable(username: string): boolean {
  const u = username.replace(/^@+/, "").trim();
  if (!u || u.length < 3) return false;
  if (/^\d+$/.test(u)) return false;
  if (CHANNEL_LIKE_USERNAME.test(u)) return false;
  return /[a-zA-Zа-яА-ЯёЁ]/.test(u);
}

const CHANNEL_LIKE_USERNAME = /digital_sub|subs_store|spotify|reviews|gpt_store/i;

export function isBadAuthorLabel(name: string): boolean {
  const n = stripEmojis(name).trim();
  if (!n) return true;
  if (BAD_AUTHOR_PATTERN.test(n)) return true;
  if (/^\d+$/.test(n)) return true;
  if (EMBEDDED_DATETIME_PATTERN.test(n)) return true;
  return false;
}

export function sanitizeReviewAuthorName(input: {
  authorName: string;
  authorUsername?: string | null;
  seed: string;
}): string {
  const raw = stripEmojis(input.authorName).trim();
  const username = input.authorUsername?.replace(/^@+/, "").trim() || null;

  if (looksLikeRealPersonName(raw)) {
    return normalizePersonName(raw);
  }

  if (username && usernameLooksDisplayable(username)) {
    const fromUser = username.replace(/[_\d]+$/g, " ").replace(/_/g, " ").trim();
    if (fromUser.length >= 3 && /[a-zA-Zа-яА-ЯёЁ]{2,}/.test(fromUser)) {
      return normalizePersonName(fromUser);
    }
  }

  return displayNameFromSeed(username || input.seed);
}

/** Парсит «17 декабря 2025» или ISO для сортировки. */
export function reviewSortTimestamp(dateLabel: string, isoDate?: string | null): number {
  if (isoDate) {
    const t = new Date(isoDate).getTime();
    if (!Number.isNaN(t)) return t;
  }

  const label = dateLabel.trim().toLowerCase();
  const ru = label.match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i);
  if (ru) {
    const day = Number(ru[1]);
    const month = RU_MONTHS[ru[2]!.toLowerCase()];
    const year = Number(ru[3]);
    if (month) return new Date(year, month - 1, day).getTime();
  }

  const dmy = label.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    return new Date(year, month - 1, day).getTime();
  }

  return 0;
}

export function sortPublicReviewsNewestFirst(items: PublicReview[]): PublicReview[] {
  return [...items].sort(
    (a, b) => reviewSortTimestamp(b.dateLabel) - reviewSortTimestamp(a.dateLabel),
  );
}

/** Убирает emoji и «))»-смайлы из текста отзыва. */
export function sanitizeReviewContent(text: string): string {
  let out = stripEmojis(text)
    .replace(/[⭐★☆]/g, "")
    .replace(/\){2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return out;
}

export function shouldHideUsername(username: string | null | undefined): boolean {
  if (!username) return true;
  const u = username.replace(/^@+/, "").trim();
  return !u || /^\d+$/.test(u) || CHANNEL_LIKE_USERNAME.test(u);
}
