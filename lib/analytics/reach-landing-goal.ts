export type LandingGoalSite = "gpt-store" | "subs-store";

export type LandingGoalName =
  | "landing_sticky_cta_click"
  | "landing_scroll_to_pricing"
  | "landing_hero_cta_click"
  | "landing_hero_ab_assigned"
  | "landing_hero_ab_badge"
  | "landing_hero_ab_h1";

/** Создайте в Я.Метрике (reachGoal) с теми же идентификаторами. */
export const LANDING_METRIKA_GOALS: LandingGoalName[] = [
  "landing_sticky_cta_click",
  "landing_scroll_to_pricing",
  "landing_hero_cta_click",
  "landing_hero_ab_assigned",
  "landing_hero_ab_badge",
  "landing_hero_ab_h1",
];

export function reachLandingGoal(
  goal: LandingGoalName,
  params?: { site?: LandingGoalSite; source?: string },
): void {
  if (typeof window === "undefined") return;

  const ymId = Number(process.env.NEXT_PUBLIC_YM_ID);
  if (!ymId || typeof window.ym !== "function") return;

  try {
    window.ym(ymId, "reachGoal", goal, params ?? {});
  } catch {
    /* analytics must not break UX */
  }
}
