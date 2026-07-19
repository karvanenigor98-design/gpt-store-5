import type { PromoCode } from "@/lib/store-config";

export type PromoFailReason =
  | "empty"
  | "not_found"
  | "inactive"
  | "expired"
  | "exhausted"
  | "wrong_plan"
  | "wrong_site";

export type PromoResolveResult =
  | { ok: true; promo: PromoCode }
  | { ok: false; reason: PromoFailReason; technical: string };

const USER_SAFE: Record<PromoFailReason, string> = {
  empty: "Введите промокод",
  not_found: "Промокод не найден",
  inactive: "Промокод неактивен",
  expired: "Срок действия промокода истёк",
  exhausted: "Лимит использований промокода исчерпан",
  wrong_plan: "Промокод не подходит к выбранному тарифу",
  wrong_site: "Промокод предназначен для другого магазина",
};

export function promoUserMessage(reason: PromoFailReason): string {
  return USER_SAFE[reason];
}

/**
 * Resolve promo with typed failure reasons (server logs get `technical`).
 * `codes` must already be scoped to the current store.
 */
export function resolvePromoForPlan(
  codes: PromoCode[],
  code: string | null | undefined,
  planId: string,
): PromoResolveResult {
  const normalized = (code ?? "").trim().toUpperCase();
  if (!normalized) {
    return { ok: false, reason: "empty", technical: "empty_code" };
  }

  const candidates = codes.filter((c) => c.code === normalized);
  if (!candidates.length) {
    return {
      ok: false,
      reason: "not_found",
      technical: `code_not_in_store_list:${normalized}`,
    };
  }

  const anyInactive = candidates.every((c) => !c.active);
  if (anyInactive) {
    const sample = candidates[0]!;
    if (sample.maxUses != null && sample.usesCount != null && sample.usesCount >= sample.maxUses) {
      return {
        ok: false,
        reason: "exhausted",
        technical: `uses ${sample.usesCount}/${sample.maxUses}`,
      };
    }
    return {
      ok: false,
      reason: "inactive",
      technical: `inactive_or_window:${normalized}`,
    };
  }

  const active = candidates.filter((c) => c.active);
  const planMatch = active.find((c) => !c.planIds?.length || c.planIds.includes(planId));
  if (!planMatch) {
    return {
      ok: false,
      reason: "wrong_plan",
      technical: `plan=${planId}; allowed=${active.map((c) => (c.planIds ?? []).join("|") || "*").join(",")}`,
    };
  }

  return { ok: true, promo: planMatch };
}
