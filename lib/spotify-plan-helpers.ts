import type { SpotifyPlan, SpotifyTabId } from "@/lib/content/spotify";
import {
  getSpotifyPlanTier,
  SPOTIFY_TAB_COMPARE,
  type SpotifyPlanTier,
} from "@/lib/content/spotify-pricing-ui";

/** Маркетинговое округление ₽/мес: 363 → 349, 563 → 549 */
export function roundMarketingMonthly(raw: number): number {
  const n = Math.round(raw);
  if (n <= 0) return n;
  if (n < 100) {
    let c = Math.floor(n / 10) * 10 + 9;
    if (c > n + 2) c -= 10;
    return Math.max(9, c);
  }
  let candidate = Math.floor(n / 10) * 10 + 9;
  while (candidate > n + 3) candidate -= 10;
  if (n - candidate > 22) {
    const higher = candidate + 10;
    if (higher <= n + 3) candidate = higher;
  }
  return Math.max(candidate, 9);
}

/** Месяцы из slug/названия, если в БД нет duration_months. */
export function inferDurationMonths(plan: SpotifyPlan): number | null {
  if (plan.durationMonths != null && plan.durationMonths > 0) return plan.durationMonths;
  if (plan.id.includes("new-account")) return null;
  const slugM = plan.id.match(/-(\d+)m$/);
  if (slugM) return Number(slugM[1]);
  if (/12/.test(plan.name)) return 12;
  if (/6/.test(plan.name)) return 6;
  if (/3/.test(plan.name)) return 3;
  if (/1/.test(plan.name)) return 1;
  return null;
}

export function computeMonthlyPrice(plan: SpotifyPlan): number | null {
  const months = inferDurationMonths(plan);
  if (!months || months < 2) return null;

  if (plan.monthlyPrice != null && plan.monthlyPrice > 0) {
    return roundMarketingMonthly(plan.monthlyPrice);
  }
  return roundMarketingMonthly(plan.price / months);
}

/** Экономия vs помесячная оплата (1 мес в той же категории). */
export function computeSavingsText(plan: SpotifyPlan, tabPlans: SpotifyPlan[]): string | null {
  if (plan.savingsText?.trim()) return plan.savingsText.trim();
  const months = inferDurationMonths(plan);
  if (!months || months < 3) return null;

  const baseline = tabPlans.find(
    (p) =>
      p.tab === plan.tab &&
      p.id !== plan.id &&
      inferDurationMonths(p) === 1 &&
      !p.id.includes("new-account"),
  );
  if (!baseline) return null;

  const perMonthLong = plan.price / months;
  const perMonthShort = baseline.price;
  if (perMonthShort <= perMonthLong) return null;

  const saved = Math.round((perMonthShort - perMonthLong) * months);
  if (saved <= 0) return null;
  return `Экономия ${saved.toLocaleString("ru")} ₽ vs ${months}× по месяцу`;
}

/** Текст бейджа скидки (админка или % от зачёркнутой цены). */
export function resolvePlanDiscountBadge(
  plan: { landingDiscountName?: string | null; oldPrice?: number },
  displayPrice: number,
  strikePrice: number | undefined,
): string | null {
  const named = plan.landingDiscountName?.trim();
  if (named) return named;
  const base = strikePrice ?? plan.oldPrice;
  if (base != null && base > displayPrice) {
    const pct = Math.round(((base - displayPrice) / base) * 100);
    if (pct > 0) return `Скидка ${pct}%`;
  }
  return null;
}

/** Разбор строки экономии для акцентной вёрстки над CTA. */
export function parseSavingsDisplay(text: string): { amount: string; suffix: string } {
  const m = text.match(/^Экономия\s+(.+?)\s+(vs\s+.+)$/i);
  if (m) return { amount: m[1].trim(), suffix: m[2].trim() };
  return { amount: text, suffix: "" };
}

/** Единый порядок витрины: 1 мес → 3 мес → 12 мес → 6 мес → новый аккаунт. */
const PLAN_DISPLAY_ORDER: SpotifyPlanTier[] = [
  "quick",
  "popular",
  "premium",
  "standard",
  "entry",
];

function tierSortIndex(_tab: SpotifyTabId, tier: SpotifyPlanTier): number {
  const idx = PLAN_DISPLAY_ORDER.indexOf(tier);
  return idx >= 0 ? idx : PLAN_DISPLAY_ORDER.length;
}

/** Порядок карточек = порядок колонок в блоке «Как выбрать» сверху. */
export function sortPlansForDisplay(plans: SpotifyPlan[]): SpotifyPlan[] {
  if (!plans.length) return plans;
  const tab = plans[0].tab;

  return [...plans].sort((a, b) => {
    const ta = tierSortIndex(tab, getSpotifyPlanTier(a));
    const tb = tierSortIndex(tab, getSpotifyPlanTier(b));
    if (ta !== tb) return ta - tb;
    return (inferDurationMonths(a) ?? 0) - (inferDurationMonths(b) ?? 0);
  });
}

export function isFeaturedPlan(plan: SpotifyPlan): boolean {
  const tab = plan.tab;
  const compareTiers = SPOTIFY_TAB_COMPARE[tab].map((c) => c.tier);
  return compareTiers.includes(getSpotifyPlanTier(plan));
}

/** На мобилке — первые 3 тарифа в том же порядке, что и compare-блок. */
export function getFeaturedPlansForTab(plans: SpotifyPlan[]): SpotifyPlan[] {
  const sorted = sortPlansForDisplay(plans);
  const compareLen = SPOTIFY_TAB_COMPARE[plans[0]?.tab ?? "individual"].length;
  return sorted.slice(0, compareLen);
}

/** Акцент карточки (рамка, арка, кнопка) по типу тарифа. */
export function planCardAccent(plan: SpotifyPlan): {
  color: string;
  glow: string;
  barPercent: number;
} {
  const tier = getSpotifyPlanTier(plan);

  if (tier === "premium") {
    return { color: "#f59e0b", glow: "rgba(245,158,11,0.2)", barPercent: 100 };
  }
  if (tier === "popular") {
    return { color: "#1DB954", glow: "rgba(29,185,84,0.18)", barPercent: 72 };
  }
  if (tier === "quick") {
    return { color: "#38bdf8", glow: "rgba(56,189,248,0.14)", barPercent: 30 };
  }
  if (tier === "entry") {
    return { color: "#94a3b8", glow: "rgba(100,116,139,0.15)", barPercent: 28 };
  }
  return { color: "#1DB954", glow: "rgba(29,185,84,0.12)", barPercent: 55 };
}
