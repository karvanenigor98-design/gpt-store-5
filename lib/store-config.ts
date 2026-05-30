import { CHATGPT_PLANS, type ExtendedPlan } from "@/lib/chatgpt-data";
import { applyHeroPromoDisplayToGptPlans } from "@/lib/landing/hero-promo-landing-discount";
import type { LandingDiscount } from "@/lib/pricing-helpers";
import { applyLandingDiscount, pickLandingDiscount } from "@/lib/pricing-helpers";
import { fetchPromoCodesFromDb } from "@/lib/promocodes/db-promo";
import { createAdminClient } from "@/lib/supabase/server";

export type PromoCode = {
  code: string;
  type: "percent" | "fixed";
  value: number;
  active: boolean;
  planIds?: string[];
  /** Если из таблицы promocodes */
  dbId?: string;
  maxUses?: number | null;
  usesCount?: number;
};

export type { LandingDiscount } from "@/lib/pricing-helpers";

export type LandingSectionsConfig = {
  showReviews: boolean;
  showFaq: boolean;
  showCompare: boolean;
};

export type PlanAvailabilityConfig = Record<string, boolean>;

export type StoreConfig = {
  plans: ExtendedPlan[];
  promoCodes: PromoCode[];
  landingSections: LandingSectionsConfig;
  landingDiscounts: LandingDiscount[];
};

const DEFAULT_PLANS: ExtendedPlan[] = [...CHATGPT_PLANS.plus, ...CHATGPT_PLANS.pro];
const DEFAULT_SECTIONS: LandingSectionsConfig = {
  showReviews: true,
  showFaq: true,
  showCompare: true,
};

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function normalizePlan(input: unknown, fallback: ExtendedPlan): ExtendedPlan {
  const p = (input ?? {}) as Partial<ExtendedPlan>;
  return {
    ...fallback,
    id: p.id ?? fallback.id,
    productId: p.productId ?? fallback.productId,
    name: p.name ?? fallback.name,
    description: p.description ?? fallback.description,
    period: p.period ?? fallback.period,
    currency: p.currency ?? fallback.currency,
    cta: p.cta ?? fallback.cta,
    badge: p.badge ?? fallback.badge,
    isPopular: typeof p.isPopular === "boolean" ? p.isPopular : fallback.isPopular,
    features: Array.isArray(p.features) ? p.features.filter((x): x is string => typeof x === "string") : fallback.features,
    price: toNumber(p.price, fallback.price),
    inStock: typeof p.inStock === "boolean" ? p.inStock : true,
  };
}

function normalizePlanAvailability(input: unknown): PlanAvailabilityConfig {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: PlanAvailabilityConfig = {};
  for (const [id, value] of Object.entries(input as Record<string, unknown>)) {
    if (!id) continue;
    out[id] = value !== false;
  }
  return out;
}

function normalizePlans(input: unknown, availability: PlanAvailabilityConfig): ExtendedPlan[] {
  if (!Array.isArray(input)) return DEFAULT_PLANS;
  const byId = new Map(DEFAULT_PLANS.map((p) => [p.id, p]));
  const normalized = input
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((raw) => {
      const id = typeof raw.id === "string" ? raw.id : "";
      const fallback = byId.get(id) ?? DEFAULT_PLANS[0];
      const plan = normalizePlan(raw, fallback);
      return { ...plan, inStock: availability[plan.id] !== false };
    })
    .filter((p) => !!p.id);

  if (!normalized.length) {
    return DEFAULT_PLANS.map((plan) => ({ ...plan, inStock: availability[plan.id] !== false }));
  }
  return normalized;
}

function normalizePromoCodes(input: unknown): PromoCode[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((raw) => {
      const code = String(raw.code ?? "").trim().toUpperCase();
      const type = raw.type === "fixed" ? "fixed" : "percent";
      const value = toNumber(raw.value, 0);
      const active = raw.active !== false;
      const planIds = Array.isArray(raw.planIds)
        ? raw.planIds.filter((x): x is string => typeof x === "string")
        : undefined;

      const row: PromoCode = { code, type, value, active, planIds };
      return row;
    })
    .filter((p) => p.code && p.value > 0);
}

function normalizeSections(input: unknown): LandingSectionsConfig {
  if (!input || typeof input !== "object") return DEFAULT_SECTIONS;
  const v = input as Partial<LandingSectionsConfig>;
  return {
    showReviews: v.showReviews !== false,
    showFaq: v.showFaq !== false,
    showCompare: v.showCompare !== false,
  };
}

function mergePromoCodes(jsonCodes: PromoCode[], dbCodes: PromoCode[]): PromoCode[] {
  const map = new Map<string, PromoCode>();
  for (const c of jsonCodes) map.set(c.code, c);
  for (const c of dbCodes) map.set(c.code, c);
  return Array.from(map.values());
}

function applyLandingDiscountsToPlans(plans: ExtendedPlan[], discounts: LandingDiscount[]): ExtendedPlan[] {
  return plans.map((plan) => {
    const landing = pickLandingDiscount(plan.id, plan.productId, discounts);
    if (!landing) return plan;

    const { displayPrice, cut, name } = applyLandingDiscount(plan.price, landing);
    if (cut <= 0 || displayPrice <= 0) return plan;

    // Прокидываем цену уже с витринной скидкой во все части приложения.
    const withDiscount = {
      ...plan,
      price: displayPrice,
      // Доп. поля для UI (без ломки существующих типов).
      original_price: plan.price,
      landing_discount_name: name,
      landing_discount_cut: cut,
    } as ExtendedPlan & Record<string, unknown>;
    return withDiscount as ExtendedPlan;
  });
}

function finalizeGptStorePlans(plans: ExtendedPlan[], discounts: LandingDiscount[]): ExtendedPlan[] {
  return applyHeroPromoDisplayToGptPlans(applyLandingDiscountsToPlans(plans, discounts));
}

export async function getStoreConfig(): Promise<StoreConfig> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) {
    return {
      plans: finalizeGptStorePlans(DEFAULT_PLANS, []),
      promoCodes: [],
      landingSections: DEFAULT_SECTIONS,
      landingDiscounts: [],
    };
  }

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["pricing_plans", "promo_codes", "landing_sections", "plan_availability"]);

    const map: Record<string, unknown> = {};
    for (const item of data ?? []) map[item.key] = item.value;

    let dbPromos: PromoCode[] = [];
    let dbDiscounts: LandingDiscount[] = [];
    try {
      dbPromos = await fetchPromoCodesFromDb(supabase);
    } catch {
      dbPromos = [];
    }
    try {
      const { data: discountRows } = await supabase
        .from("landing_discounts")
        .select("id, name, discount_type, discount_value, applies_to, is_active")
        .order("created_at", { ascending: false });
      dbDiscounts = (discountRows ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        type: row.discount_type,
        value: row.discount_value,
        appliesTo: row.applies_to,
        active: Boolean(row.is_active),
      }));
    } catch {
      dbDiscounts = [];
    }

    const availability = normalizePlanAvailability(map.plan_availability);

    const mergedPlans = normalizePlans(map.pricing_plans, availability);

    return {
      plans: finalizeGptStorePlans(mergedPlans, dbDiscounts),
      promoCodes: mergePromoCodes(normalizePromoCodes(map.promo_codes), dbPromos),
      landingSections: normalizeSections(map.landing_sections),
      landingDiscounts: dbDiscounts,
    };
  } catch {
    return {
      plans: finalizeGptStorePlans(DEFAULT_PLANS, []),
      promoCodes: [],
      landingSections: DEFAULT_SECTIONS,
      landingDiscounts: [],
    };
  }
}

export function splitPlans(plans: ExtendedPlan[]) {
  return {
    plus: plans.filter((p) => p.productId === "chatgpt-plus"),
    pro: plans.filter((p) => p.productId === "chatgpt-pro"),
  };
}

export function findPromo(codes: PromoCode[], code: string | null | undefined, planId: string): PromoCode | null {
  const normalized = (code ?? "").trim().toUpperCase();
  if (!normalized) return null;
  const found = codes.find((c) => {
    if (!c.active || c.code !== normalized) return false;
    if (!c.planIds?.length) return true;
    return c.planIds.includes(planId);
  });
  return found ?? null;
}

export function applyPromo(price: number, promo: PromoCode | null) {
  if (!promo) return { finalPrice: price, discountValue: 0 };
  const rawDiscount =
    promo.type === "percent"
      ? Math.round((price * promo.value) / 100)
      : Math.round(promo.value);
  const discountValue = Math.max(0, Math.min(price, rawDiscount));
  return { finalPrice: Math.max(0, price - discountValue), discountValue };
}

export { applyLandingDiscount, pickLandingDiscount } from "@/lib/pricing-helpers";

export function getDefaultAdminPricingJson(): string {
  return JSON.stringify(DEFAULT_PLANS, null, 2);
}
