import type { PromoDeadline } from "@/lib/landing/promo-deadline";

export type HeroPromoSiteKey = "gpt" | "spotify";

export type HeroPromoSiteConfig = {
  enabled: boolean;
  /** ID тарифа на витрине (plus-std, spotify-ind-3m, …) */
  featuredPlanId: string;
  /** Цена по акции — оплата и checkout */
  promoSalePrice: number;
  /** Зачёркнутая цена «без скидки» */
  promoOriginalPrice: number;
  /** Бейдж на карточке */
  discountLabel: string;
  fallbackDiscountPercent: number;
  deadline: PromoDeadline;
  promoTitle: string;
};

/** Летняя акция до 30 июня — фиксированные цены на featured-тариф. */
export const HERO_PROMO_CONFIG: Record<HeroPromoSiteKey, HeroPromoSiteConfig> = {
  gpt: {
    enabled: true,
    featuredPlanId: "plus-new",
    promoSalePrice: 1590,
    promoOriginalPrice: 1990,
    discountLabel: "−20%",
    fallbackDiscountPercent: 10,
    deadline: { year: 2026, month: 6, day: 30 },
    promoTitle: "Летняя акция",
  },
  spotify: {
    enabled: true,
    featuredPlanId: "spotify-ind-3m",
    promoSalePrice: 1090,
    promoOriginalPrice: 1290,
    discountLabel: "−10%",
    fallbackDiscountPercent: 10,
    deadline: { year: 2026, month: 6, day: 30 },
    promoTitle: "Летняя акция",
  },
};

export function heroPromoFixedDisplay(config: HeroPromoSiteConfig): {
  original: number;
  sale: number;
  label: string;
} | null {
  const { promoOriginalPrice: original, promoSalePrice: sale, discountLabel, fallbackDiscountPercent } =
    config;
  if (original <= sale || sale <= 0) return null;
  return {
    original,
    sale,
    label: discountLabel || `−${fallbackDiscountPercent}%`,
  };
}
