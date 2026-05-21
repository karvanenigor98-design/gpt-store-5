import { SPOTIFY_PLANS, type SpotifyPlan, type SpotifyTabId } from "@/lib/content/spotify";
import {
  computeMonthlyPrice,
  inferDurationMonths,
  roundMarketingMonthly,
} from "@/lib/spotify-plan-helpers";
import {
  applyLandingDiscount,
  pickLandingDiscount,
  type LandingDiscount,
} from "@/lib/pricing-helpers";
import type { PromoCode } from "@/lib/store-config";
import { parseTariffSlugsFromRow } from "@/lib/admin/subs-discount-scope";
import { fetchSubsDiscounts, fetchSubsPromocodes } from "@/lib/admin/subs-discount-db";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

type TariffRow = {
  slug: string;
  category: string;
  title: string;
  price: number;
  old_price?: number | null;
  badge?: string | null;
  description?: string | null;
  short_description?: string | null;
  features?: unknown;
  duration_months?: number | null;
  monthly_price?: number | null;
  savings_text?: string | null;
  is_popular?: boolean | null;
  is_best_value?: boolean | null;
  cta_text?: string | null;
  requires_additional_data?: boolean | null;
  allow_promocodes?: boolean | null;
  allow_discounts?: boolean | null;
};

type DiscountRow = {
  id: string;
  title: string;
  type: string;
  value: number;
  tariff_slugs?: string[] | null;
  description?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active?: boolean | null;
};

type PromocodeRow = {
  id: string;
  code: string;
  type: string;
  value: number;
  max_uses?: number | null;
  used_count?: number | null;
  tariff_slugs?: string[] | null;
  expires_at?: string | null;
  is_active?: boolean | null;
};

export type SubsStoreConfig = {
  plans: SpotifyPlan[];
  landingDiscounts: LandingDiscount[];
  promoCodes: PromoCode[];
  source: "supabase" | "static";
};

function mapCategoryToTab(category: string): SpotifyTabId {
  if (category === "duo") return "duo";
  if (category === "family") return "family";
  return "individual";
}

/** 3 мес = popular, 12 мес = best value — как на вкладке «Индивидуальная». */
function resolveTariffFeaturedFlags(
  row: TariffRow,
  badge: string | undefined,
  durationMonths: number | undefined,
): { isPopular: boolean; isBestValue: boolean } {
  const months =
    durationMonths != null && durationMonths > 0 ? durationMonths : undefined;

  if (months === 12) {
    return { isPopular: false, isBestValue: row.is_best_value !== false };
  }
  if (months === 3) {
    return { isPopular: row.is_popular !== false, isBestValue: false };
  }
  if (row.is_best_value === true) {
    return { isPopular: false, isBestValue: true };
  }
  if (row.is_popular === true) {
    return { isPopular: true, isBestValue: false };
  }
  const b = badge ?? "";
  if (/максимум|лучший/i.test(b)) {
    return { isPopular: false, isBestValue: true };
  }
  if (/популярн|главн/i.test(b)) {
    return { isPopular: true, isBestValue: false };
  }
  if (/выгодно/i.test(b) && months !== 12) {
    return { isPopular: true, isBestValue: false };
  }
  return { isPopular: false, isBestValue: false };
}

export function tariffRowToSpotifyPlan(row: TariffRow): SpotifyPlan {
  const featuresRaw = row.features;
  const features = Array.isArray(featuresRaw)
    ? featuresRaw.map((x) => String(x)).filter((s) => s.length > 0)
    : [];
  const badge = row.badge?.trim() || undefined;
  const tab = mapCategoryToTab(String(row.category || "individual"));
  const durationMonths =
    row.duration_months != null && row.duration_months > 0
      ? Math.round(Number(row.duration_months))
      : undefined;
  const oldPrice =
    row.old_price != null && Number(row.old_price) > 0
      ? Math.round(Number(row.old_price))
      : undefined;
  const { isPopular, isBestValue } = resolveTariffFeaturedFlags(row, badge, durationMonths);

  const base: SpotifyPlan = {
    id: String(row.slug),
    tab,
    name: String(row.title || "").trim() || "Тариф",
    price: Math.round(Number(row.price) || 0),
    oldPrice,
    badge,
    description: (row.description && String(row.description).trim()) || "",
    shortDescription: (row.short_description && String(row.short_description).trim()) || undefined,
    features: features.length ? features : ["—"],
    isPopular,
    isBestValue,
    durationMonths,
    monthlyPrice:
      row.monthly_price != null && row.monthly_price > 0
        ? roundMarketingMonthly(Number(row.monthly_price))
        : undefined,
    savingsText: (row.savings_text && String(row.savings_text).trim()) || undefined,
    ctaText: (row.cta_text && String(row.cta_text).trim()) || undefined,
    requiresAccountData: row.requires_additional_data === true,
    allowPromocodes: row.allow_promocodes !== false,
    allowDiscounts: row.allow_discounts !== false,
  };

  const withDuration: SpotifyPlan = {
    ...base,
    durationMonths: base.durationMonths ?? inferDurationMonths(base) ?? undefined,
  };
  return {
    ...withDuration,
    monthlyPrice: withDuration.monthlyPrice ?? computeMonthlyPrice(withDuration) ?? undefined,
  };
}

function isWithinValidity(startsAt?: string | null, endsAt?: string | null, now = Date.now()): boolean {
  if (startsAt) {
    const s = new Date(startsAt).getTime();
    if (!Number.isNaN(s) && s > now) return false;
  }
  if (endsAt) {
    const e = new Date(endsAt).getTime();
    if (!Number.isNaN(e) && e < now) return false;
  }
  return true;
}

export function expandSubsDiscountRows(rows: DiscountRow[]): LandingDiscount[] {
  const out: LandingDiscount[] = [];
  for (const row of rows) {
    if (row.is_active === false) continue;
    if (!isWithinValidity(row.starts_at, row.ends_at)) continue;

    const type = row.type === "fixed" ? "fixed" : "percent";
    const value = Math.round(Number(row.value) || 0);
    if (value <= 0) continue;

    const slugs = parseTariffSlugsFromRow(row) ?? [];
    if (!slugs.length) {
      out.push({
        id: row.id,
        name: row.title,
        type,
        value,
        appliesTo: "all",
        active: true,
      });
      continue;
    }

    for (const slug of slugs) {
      out.push({
        id: `${row.id}:${slug}`,
        name: row.title,
        type,
        value,
        appliesTo: slug,
        active: true,
      });
    }
  }
  return out;
}

export function applyLandingDiscountsToSpotifyPlans(
  plans: SpotifyPlan[],
  discounts: LandingDiscount[],
): SpotifyPlan[] {
  return plans.map((plan) => {
    const landing = pickLandingDiscount(plan.id, plan.tab, discounts);
    if (!landing) return plan;

    const { displayPrice, cut, name } = applyLandingDiscount(plan.price, landing);
    if (cut <= 0 || displayPrice <= 0) return plan;

    return {
      ...plan,
      price: displayPrice,
      originalPrice: plan.price,
      landingDiscountName: name,
    };
  });
}

function mapPromocodeRows(rows: PromocodeRow[]): PromoCode[] {
  const now = Date.now();
  return rows
    .filter((r) => r.is_active !== false)
    .filter((r) => {
      if (!r.expires_at) return true;
      const e = new Date(r.expires_at).getTime();
      return !Number.isNaN(e) && e >= now;
    })
    .filter((r) => {
      if (r.max_uses == null) return true;
      return Number(r.used_count ?? 0) < r.max_uses;
    })
    .map((r) => ({
      code: String(r.code).trim().toUpperCase(),
      type: (r.type === "fixed" ? "fixed" : "percent") as PromoCode["type"],
      value: Math.round(Number(r.value) || 0),
      active: true,
      planIds: r.tariff_slugs?.length ? r.tariff_slugs : undefined,
      dbId: r.id,
      maxUses: r.max_uses ?? null,
      usesCount: Number(r.used_count ?? 0),
    }))
    .filter((p) => p.code && p.value > 0);
}

const TARIFFS_SELECT_MINIMAL =
  "slug,category,title,price,badge,description,features,is_active,sort_order";

const TARIFFS_SELECT_BASE = `${TARIFFS_SELECT_MINIMAL},old_price`;

const TARIFFS_SELECT_EXTENDED = `${TARIFFS_SELECT_BASE},short_description,duration_months,monthly_price,savings_text,is_popular,is_best_value,cta_text,requires_additional_data,allow_promocodes,allow_discounts`;

function isSchemaColumnError(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("schema cache") ||
    m.includes("could not find") ||
    (m.includes("column") && m.includes("tariffs"))
  );
}

async function fetchActiveTariffRows(
  admin: NonNullable<ReturnType<typeof createSubsStoreAdminClient>>,
): Promise<TariffRow[] | null> {
  const selects = [TARIFFS_SELECT_EXTENDED, TARIFFS_SELECT_BASE, TARIFFS_SELECT_MINIMAL] as const;

  for (const fields of selects) {
    const res = await admin
      .from("tariffs")
      .select(fields)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (!res.error && res.data?.length) {
      return res.data as unknown as TariffRow[];
    }
    if (res.error && !isSchemaColumnError(res.error.message)) {
      return null;
    }
  }

  return null;
}

async function loadFromSupabase(): Promise<SubsStoreConfig | null> {
  const admin = createSubsStoreAdminClient();
  if (!admin) return null;

  try {
    const [tariffRows, discountsRes, promosRes] = await Promise.all([
      fetchActiveTariffRows(admin),
      fetchSubsDiscounts(admin),
      fetchSubsPromocodes(admin),
    ]);

    if (!tariffRows?.length) return null;

    const basePlans = tariffRows.map(tariffRowToSpotifyPlan);
    const landingDiscounts = discountsRes.error
      ? []
      : expandSubsDiscountRows((discountsRes.data ?? []) as DiscountRow[]);
    const promoCodes = promosRes.error ? [] : mapPromocodeRows((promosRes.data ?? []) as PromocodeRow[]);

    return {
      plans: applyLandingDiscountsToSpotifyPlans(basePlans, landingDiscounts),
      landingDiscounts,
      promoCodes,
      source: "supabase",
    };
  } catch {
    return null;
  }
}

/** Тарифы + витринные скидки + промокоды из Subs Supabase (или статический fallback). */
export async function getSubsStoreConfig(): Promise<SubsStoreConfig> {
  const fromDb = await loadFromSupabase();
  if (fromDb) return fromDb;

  return {
    plans: SPOTIFY_PLANS,
    landingDiscounts: [],
    promoCodes: [],
    source: "static",
  };
}
