import type { MetrikaGoalParams } from "@/lib/metrics";
import {
  trackGPTCheckout,
  trackGPTPayClick,
  trackGPTPaymentSuccess,
  trackGptSelectPlan,
  trackGoal,
} from "@/lib/metrics";

/** Идентификаторы целей в кабинете Я.Метрики (тип: JavaScript-событие / reachGoal). */
export type GptFunnelGoalName =
  | "gpt_select_plan"
  | "gpt_checkout"
  | "gpt_checkout_start"
  | "gpt_click_pay"
  | "gpt_payment_success";

export const GPT_FUNNEL_METRIKA_GOALS: GptFunnelGoalName[] = [
  "gpt_select_plan",
  "gpt_checkout",
  "gpt_click_pay",
  "gpt_payment_success",
];

export type GptFunnelGoalParams = MetrikaGoalParams;

/** @deprecated Предпочитайте прямые вызовы из @/lib/metrics */
export function reachGptFunnelGoal(
  goal: GptFunnelGoalName,
  params?: GptFunnelGoalParams,
): void {
  switch (goal) {
    case "gpt_select_plan":
      if (params?.planId) trackGptSelectPlan(params.planId, params.source);
      break;
    case "gpt_checkout":
    case "gpt_checkout_start":
      trackGPTCheckout(params);
      break;
    case "gpt_click_pay":
      if (params?.planId) trackGPTPayClick(params.planId, params.source);
      break;
    case "gpt_payment_success":
      trackGPTPaymentSuccess(params?.orderId, params?.source);
      break;
    default:
      trackGoal("gpt", goal, params);
  }
}
