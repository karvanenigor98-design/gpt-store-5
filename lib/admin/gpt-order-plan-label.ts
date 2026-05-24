import { CHATGPT_PLANS } from "@/lib/chatgpt-data";

const PLAN_NAME_BY_ID = new Map(
  [...CHATGPT_PLANS.plus, ...CHATGPT_PLANS.pro].map((p) => [p.id, p.name]),
);

/** Подпись тарифа для админки (колонка orders.plan_name в БД может отсутствовать). */
export function resolveGptOrderPlanLabel(order: {
  plan_id: string;
  product: string | null;
}): string {
  const fromCatalog = PLAN_NAME_BY_ID.get(order.plan_id);
  if (fromCatalog) return fromCatalog;

  const product = (order.product ?? "").toLowerCase();
  if (product === "chatgpt-plus") return "ChatGPT Plus";
  if (product === "chatgpt-pro") return "ChatGPT Pro";

  const id = order.plan_id.toLowerCase();
  if (id.includes("plus")) return "ChatGPT Plus";
  if (id.includes("pro")) return "ChatGPT Pro";

  return order.plan_id || "—";
}
