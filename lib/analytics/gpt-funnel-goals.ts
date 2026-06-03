import { getGptStoreYmId } from "@/lib/analytics/gpt-store-metrika";

/** Идентификаторы целей в кабинете Я.Метрики (тип: JavaScript-событие / reachGoal). */
export type GptFunnelGoalName =
  | "gpt_select_plan"
  | "gpt_checkout_start"
  | "gpt_click_pay"
  | "gpt_payment_success";

export const GPT_FUNNEL_METRIKA_GOALS: GptFunnelGoalName[] = [
  "gpt_select_plan",
  "gpt_checkout_start",
  "gpt_click_pay",
  "gpt_payment_success",
];

export type GptFunnelGoalParams = {
  planId?: string;
  source?: string;
  orderId?: string;
};

export function reachGptFunnelGoal(
  goal: GptFunnelGoalName,
  params?: GptFunnelGoalParams,
): void {
  if (typeof window === "undefined") return;

  const ymId = getGptStoreYmId();
  const ym = (window as { ym?: (id: number, action: string, ...args: unknown[]) => void }).ym;
  if (!ymId || typeof ym !== "function") return;

  try {
    ym(ymId, "reachGoal", goal, params ?? {});
  } catch {
    /* analytics must not break UX */
  }
}
