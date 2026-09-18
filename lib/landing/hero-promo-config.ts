import type { PromoDeadline, PromoWindow } from "@/lib/landing/promo-deadline";
import { formatPromoPeriodRange } from "@/lib/landing/promo-deadline";

export type HeroPromoSiteKey = "gpt" | "spotify";

export type HeroPromoSiteConfig = {
  enabled: boolean;
  /** ID тарифа на витрине (plus-ready, spotify-duo-3m, …) */
  featuredPlanId: string;
  /** Цена по акции — оплата и checkout (итоговая) */
  promoSalePrice: number;
  /** Зачёркнутая цена «без скидки» (только визуал) */
  promoOriginalPrice: number;
  /** Бейдж скидки, напр. «Скидка 10%» */
  discountLabel: string;
  fallbackDiscountPercent: number;
  /** Экономия в ₽ (promoOriginal − promoSale) */
  savingsRub: number;
  /** Календарное окно акции (Europe/Moscow) */
  window: PromoWindow;
  /** Alias end date — совместимость со старыми хелперами */
  deadline: PromoDeadline;
  /** Текст на акционной плашке */
  promoTitle: string;
  /** Короткий период, напр. «1–31 августа» */
  periodBadge: string;
  /** Витринное название карточки (не системное имя тарифа) */
  displayPlanName: string | null;
  /** Продуктовый оффер под названием */
  offerHeadline: string;
  /** Вторая строка оффера (опционально) */
  offerSubline: string | null;
  /** Подсказка выгоды (Spotify ≈₽/мес) */
  monthlyHint: string | null;
  /** Пункты popover с условиями */
  terms: string[];
};

/** Календарное окно сентября 2026 (МСК) — последний день 30.09. */
const SEPTEMBER_2026: PromoWindow = {
  start: { year: 2026, month: 9, day: 1 },
  end: { year: 2026, month: 9, day: 30 },
};

/**
 * GPT / Spotify: сентябрьская акция 1–30.09.2026 (МСК).
 * Итоговые цены = promoSalePrice (без повторного % в checkout).
 */
export const HERO_PROMO_CONFIG: Record<HeroPromoSiteKey, HeroPromoSiteConfig> = {
  gpt: {
    enabled: true,
    featuredPlanId: "plus-fast",
    promoSalePrice: 2590,
    promoOriginalPrice: 2890,
    discountLabel: "Скидка 10%",
    fallbackDiscountPercent: 10,
    savingsRub: 300,
    window: SEPTEMBER_2026,
    deadline: SEPTEMBER_2026.end,
    promoTitle: "Скидка 10% · до 30 сентября",
    periodBadge: "1–30 сентября",
    displayPlanName: "ChatGPT Plus — 1 месяц",
    offerHeadline: "Подключение на ваш аккаунт — обычно 5–15 минут после передачи данных.",
    offerSubline: null,
    monthlyHint: null,
    terms: [
      "Акция действует с 1 по 30 сентября 2026 года (по московскому времени).",
      "Указанная на карточке цена уже итоговая — дополнительные 10% автоматически не вычитаются.",
      "Акция относится только к тарифу Plus без входа в аккаунт.",
      "Совместимость с промокодами определяется правилами сайта на момент оформления.",
    ],
  },
  spotify: {
    enabled: true,
    featuredPlanId: "spotify-new-account",
    promoSalePrice: 349,
    promoOriginalPrice: 440,
    discountLabel: "Скидка 91 ₽",
    fallbackDiscountPercent: 21,
    savingsRub: 91,
    window: SEPTEMBER_2026,
    deadline: SEPTEMBER_2026.end,
    promoTitle: "Скидка 91 ₽ · до 30 сентября",
    periodBadge: "1–30 сентября",
    displayPlanName: "Spotify Premium — новый аккаунт",
    offerHeadline: "Готовый Premium на новом аккаунте — если текущий профиль не нужен.",
    offerSubline: null,
    monthlyHint: null,
    terms: [
      "Акция действует с 1 по 30 сентября 2026 года (по московскому времени).",
      "Указанная на карточке цена уже итоговая — дополнительные скидки автоматически не вычитаются.",
      "Акция относится только к тарифу «Новый аккаунт».",
      "Совместимость с промокодами определяется правилами сайта на момент оформления.",
    ],
  },
};

export function heroPromoFixedDisplay(config: HeroPromoSiteConfig): {
  original: number;
  sale: number;
  label: string;
  savingsRub: number;
  percent: number;
} | null {
  const {
    promoOriginalPrice: original,
    promoSalePrice: sale,
    discountLabel,
    fallbackDiscountPercent,
    savingsRub,
  } = config;
  if (original <= sale || sale <= 0) return null;
  const computedSavings = original - sale;
  return {
    original,
    sale,
    label: discountLabel || `Скидка ${fallbackDiscountPercent}%`,
    savingsRub: savingsRub > 0 ? savingsRub : computedSavings,
    percent: fallbackDiscountPercent,
  };
}

export function heroPromoPeriodLabel(config: HeroPromoSiteConfig): string {
  return config.periodBadge || formatPromoPeriodRange(config.window);
}

/** Бейдж «До 30 сентября» из periodBadge «1–30 сентября» (не из calendar overflow). */
export function heroPromoUntilLabel(config: HeroPromoSiteConfig): string {
  const badge = config.periodBadge.trim();
  const dash = badge.indexOf("–");
  if (dash >= 0) {
    const until = badge.slice(dash + 1).trim();
    if (until) return `До ${until}`;
  }
  return `До ${formatPromoPeriodRange(config.window).replace(/^\d+–/, "")}`.trim();
}
