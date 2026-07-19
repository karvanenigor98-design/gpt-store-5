import { applyLandingDiscount, pickLandingDiscount, type LandingDiscount } from "@/lib/pricing-helpers";
import { heroPromoFixedDisplay, type HeroPromoSiteConfig } from "@/lib/landing/hero-promo-config";
import { isPromoDeadlineActive } from "@/lib/landing/promo-deadline";

function activeFixedPromo(config: HeroPromoSiteConfig) {
  if (!isPromoDeadlineActive(config.deadline)) return null;
  return heroPromoFixedDisplay(config);
}

export type HeroPromoOffer = {
  planId: string;
  planName: string;
  periodLabel: string;
  originalPrice: number;
  salePrice: number;
  discountLabel: string | null;
  discountPercent: number;
  checkoutHref: string;
  ctaLabel: string;
};

type GptPlanLike = {
  id: string;
  name: string;
  price: number;
  currency?: string;
  period?: string;
  original_price?: number;
  landing_discount_name?: string | null;
  productId?: string;
};

type SpotifyPlanLike = {
  id: string;
  name: string;
  price: number;
  oldPrice?: number;
  originalPrice?: number;
  landingDiscountName?: string | null;
  durationMonths?: number;
  ctaText?: string;
};

function hasRealAdminLandingDiscount(
  basePrice: number,
  planId: string,
  productId: string | undefined,
  discounts: LandingDiscount[],
): boolean {
  const landing = pickLandingDiscount(planId, productId, discounts);
  if (!landing) return false;
  const { cut, displayPrice } = applyLandingDiscount(basePrice, landing);
  return cut > 0 && displayPrice < basePrice;
}

function resolvePrices(
  basePrice: number,
  planId: string,
  productId: string | undefined,
  discounts: LandingDiscount[],
  explicitOriginal: number | undefined,
  explicitDiscountName: string | null | undefined,
  config: HeroPromoSiteConfig,
): { original: number; sale: number; label: string | null } {
  const landing = pickLandingDiscount(planId, productId, discounts);
  if (landing) {
    const { displayPrice, cut, name } = applyLandingDiscount(basePrice, landing);
    if (cut > 0 && displayPrice < basePrice) {
      return { original: basePrice, sale: displayPrice, label: name ?? explicitDiscountName ?? null };
    }
  }

  if (explicitOriginal != null && explicitOriginal > basePrice) {
    return {
      original: explicitOriginal,
      sale: basePrice,
      label: explicitDiscountName ?? null,
    };
  }

  const fixed = activeFixedPromo(config);
  if (fixed) {
    return fixed;
  }

  return { original: basePrice, sale: basePrice, label: null };
}

export function resolveGptHeroPromoOffer(
  plans: GptPlanLike[],
  discounts: LandingDiscount[],
  config: HeroPromoSiteConfig,
): HeroPromoOffer | null {
  const plan = plans.find((p) => p.id === config.featuredPlanId);
  if (!plan) return null;

  const preAppliedOriginal = plan.original_price;
  const preAppliedSale = plan.price;
  const hasPreApplied = preAppliedOriginal != null && preAppliedOriginal > preAppliedSale;

  const { original, sale, label } = hasPreApplied
    ? {
        original: preAppliedOriginal!,
        sale: preAppliedSale,
        label: plan.landing_discount_name ?? config.discountLabel,
      }
    : hasRealAdminLandingDiscount(plan.price, plan.id, plan.productId, discounts)
      ? resolvePrices(
          plan.price,
          plan.id,
          plan.productId,
          discounts,
          preAppliedOriginal,
          plan.landing_discount_name,
          config,
        )
      : (activeFixedPromo(config) ?? { original: plan.price, sale: plan.price, label: null });

  if (sale <= 0) return null;
  const hasDiscount = sale < original;
  const displayOriginal = hasDiscount ? original : sale;
  const displayLabel = hasDiscount ? label : null;

  const currency = plan.currency ?? "₽";
  const period = plan.period ?? "мес";

  return {
    planId: plan.id,
    planName: plan.name,
    periodLabel: period,
    originalPrice: displayOriginal,
    salePrice: sale,
    discountLabel: displayLabel,
    discountPercent: config.fallbackDiscountPercent,
    checkoutHref: `/checkout?plan=${encodeURIComponent(plan.id)}`,
    ctaLabel: `Подключить за ${sale.toLocaleString("ru")} ${currency}`,
  };
}

export function resolveSpotifyHeroPromoOffer(
  plans: SpotifyPlanLike[],
  discounts: LandingDiscount[],
  config: HeroPromoSiteConfig,
): HeroPromoOffer | null {
  const plan = plans.find((p) => p.id === config.featuredPlanId);
  if (!plan) return null;

  const preAppliedOriginal = plan.originalPrice ?? plan.oldPrice;
  const preAppliedSale = plan.price;
  const hasPreApplied = preAppliedOriginal != null && preAppliedOriginal > preAppliedSale;

  const { original, sale, label } = hasPreApplied
    ? {
        original: preAppliedOriginal!,
        sale: preAppliedSale,
        label: plan.landingDiscountName ?? config.discountLabel,
      }
    : hasRealAdminLandingDiscount(plan.price, plan.id, undefined, discounts)
      ? resolvePrices(
          plan.price,
          plan.id,
          undefined,
          discounts,
          plan.oldPrice,
          plan.landingDiscountName,
          config,
        )
      : (activeFixedPromo(config) ?? { original: plan.price, sale: plan.price, label: null });

  if (sale <= 0) return null;
  const hasDiscount = sale < original;
  const displayOriginal = hasDiscount ? original : sale;
  const displayLabel = hasDiscount ? label : null;

  const periodLabel =
    plan.durationMonths && plan.durationMonths > 1 ? `${plan.durationMonths} мес` : "мес";

  return {
    planId: plan.id,
    planName: plan.name,
    periodLabel,
    originalPrice: displayOriginal,
    salePrice: sale,
    discountLabel: displayLabel,
    discountPercent: config.fallbackDiscountPercent,
    checkoutHref: `/checkout/spotify?plan=${encodeURIComponent(plan.id)}`,
    ctaLabel: plan.ctaText?.trim() || `Подключить за ${sale.toLocaleString("ru")} ₽`,
  };
}
