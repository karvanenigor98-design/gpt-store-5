import type { MetrikaGoalParams } from "@/lib/metrics";
import {
  trackSpotifyCheckout,
  trackSpotifyPayClick,
  trackSpotifyPaymentFail,
  trackSpotifyPaymentSuccess,
  trackSpotifySelectPlan,
  trackGoal,
} from "@/lib/metrics";

/** Идентификаторы целей в кабинете Я.Метрики (тип: JavaScript-событие / reachGoal). */
export type SpotifyFunnelGoalName =
  | "spotify_select_plan"
  | "spotify_checkout"
  | "spotify_click_pay"
  | "spotify_payment_success"
  | "spotify_payment_fail";

export const SPOTIFY_FUNNEL_METRIKA_GOALS: SpotifyFunnelGoalName[] = [
  "spotify_select_plan",
  "spotify_checkout",
  "spotify_click_pay",
  "spotify_payment_success",
  "spotify_payment_fail",
];

export type SpotifyFunnelGoalParams = MetrikaGoalParams;

/** @deprecated Предпочитайте прямые вызовы из @/lib/metrics */
export function reachSpotifyFunnelGoal(
  goal: SpotifyFunnelGoalName,
  params?: SpotifyFunnelGoalParams,
): void {
  switch (goal) {
    case "spotify_select_plan":
      if (params?.planId) trackSpotifySelectPlan(params.planId, params.source);
      break;
    case "spotify_checkout":
      trackSpotifyCheckout(params);
      break;
    case "spotify_click_pay":
      if (params?.planId) trackSpotifyPayClick(params.planId, params.source);
      break;
    case "spotify_payment_success":
      trackSpotifyPaymentSuccess(params?.orderId, params?.source);
      break;
    case "spotify_payment_fail":
      trackSpotifyPaymentFail(params?.source);
      break;
    default:
      trackGoal("spotify", goal, params);
  }
}
