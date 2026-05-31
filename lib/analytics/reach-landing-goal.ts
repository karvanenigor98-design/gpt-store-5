export type LandingGoalSite = "gpt-store" | "subs-store";

export type LandingGoalName =
  | "landing_sticky_cta_click"
  | "landing_scroll_to_pricing"
  | "landing_hero_cta_click";

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
