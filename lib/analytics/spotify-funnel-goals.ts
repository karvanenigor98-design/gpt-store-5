import { getSubsStoreYmId } from "@/lib/analytics/subs-store-metrika";

/** Идентификаторы целей в кабинете Я.Метрики (тип: JavaScript-событие / reachGoal). */
export type SpotifyFunnelGoalName =
  | "spotify_select_plan"
  | "spotify_checkout_start"
  | "spotify_click_pay"
  | "spotify_payment_success"
  | "spotify_payment_fail";

export const SPOTIFY_FUNNEL_METRIKA_GOALS: SpotifyFunnelGoalName[] = [
  "spotify_select_plan",
  "spotify_checkout_start",
  "spotify_click_pay",
  "spotify_payment_success",
  "spotify_payment_fail",
];

export type SpotifyFunnelGoalParams = {
  planId?: string;
  source?: string;
  orderId?: string;
};

export function reachSpotifyFunnelGoal(
  goal: SpotifyFunnelGoalName,
  params?: SpotifyFunnelGoalParams,
): void {
  if (typeof window === "undefined") return;

  const ymId = getSubsStoreYmId();
  const ym = (window as { ym?: (id: number, action: string, ...args: unknown[]) => void }).ym;
  if (!ymId || typeof ym !== "function") return;

  try {
    ym(ymId, "reachGoal", goal, params ?? {});
    if (process.env.NODE_ENV === "development") {
      console.log("[ym:spotify]", ymId, "reachGoal", goal, params ?? {});
    }
  } catch {
    /* analytics must not break UX */
  }
}
