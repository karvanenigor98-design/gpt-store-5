import { resolveGptOrderPlanLabel } from "@/lib/admin/gpt-order-plan-label";
import { formatSubsTariffDisplayLabel } from "@/lib/admin/subs-tariff-display-label";

function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

export function formatAdminSubscriptionDateRu(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("ru-RU");
}

export function inferDurationMonthsFromText(text: string | null | undefined): number | null {
  if (!text) return null;
  const t = text.trim().toLowerCase();
  const numbered = t.match(/(\d+)\s*(?:мес|месяц|month)/);
  if (numbered) {
    const n = Number(numbered[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (/^год\b|12\s*(?:мес|месяц|month)/.test(t)) return 12;
  if (/^6\s*(?:мес|месяц|month)/.test(t)) return 6;
  if (/^3\s*(?:мес|месяц|month)/.test(t)) return 3;
  if (/^1\s*(?:мес|месяц|month)|^месяц|^мес\b/.test(t)) return 1;
  return null;
}

function resolveEffectiveDurationMonths(
  durationMonths: number | null | undefined,
  planTitle: string,
): number | null {
  if (durationMonths != null && durationMonths > 0) return durationMonths;
  return inferDurationMonthsFromText(planTitle);
}

/** Срок окончания: expires_at или activated_at/paid_at/created_at + durationMonths. */
export function resolveOrderSubscriptionExpiresAt(params: {
  expires_at?: string | null;
  activated_at?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  durationMonths?: number | null;
  planTitle?: string | null;
}): string | null {
  if (params.expires_at) {
    const d = new Date(params.expires_at);
    if (!Number.isNaN(d.getTime())) return params.expires_at;
  }

  const months = resolveEffectiveDurationMonths(
    params.durationMonths,
    params.planTitle ?? "",
  );
  if (!months || months <= 0) return null;

  const baseIso = params.activated_at ?? params.paid_at ?? params.created_at;
  if (!baseIso) return null;

  const base = new Date(baseIso);
  if (Number.isNaN(base.getTime())) return null;

  return addMonths(base, months).toISOString();
}

type ActiveSubscriptionInput = {
  siteSlug: "gpt-store" | "subs-store";
  status: string;
  planTitle: string;
  expiresAtIso?: string | null;
  activatedAtIso?: string | null;
  paidAtIso?: string | null;
  createdAtIso?: string | null;
  durationMonths?: number | null;
};

export function formatAdminActiveSubscriptionLabel(input: ActiveSubscriptionInput): string {
  const expiresIso = resolveOrderSubscriptionExpiresAt({
    expires_at: input.expiresAtIso,
    activated_at: input.activatedAtIso,
    paid_at: input.paidAtIso,
    created_at: input.createdAtIso,
    durationMonths: input.durationMonths,
    planTitle: input.planTitle,
  });
  const expiresLabel = formatAdminSubscriptionDateRu(expiresIso);

  const inActivation = input.status === "processing" || input.status === "activating";
  if (inActivation) {
    return expiresLabel
      ? `${input.planTitle} · активация · подписка до ${expiresLabel}`
      : `${input.planTitle} · в активации`;
  }

  if (expiresLabel) {
    return `${input.planTitle} · подписка до ${expiresLabel}`;
  }

  if (input.status === "activated" || input.status === "active" || input.status === "completed") {
    return `${input.planTitle} · активна`;
  }

  return input.planTitle;
}

export function resolveGptAdminActivePlanTitle(order: {
  plan_id: string;
  product: string | null;
  plan_name?: string | null;
}): string {
  const named = order.plan_name?.trim();
  if (named) return named;
  return resolveGptOrderPlanLabel(order);
}

export function resolveSubsAdminActivePlanTitle(tariff: {
  title?: string | null;
  slug?: string | null;
  category?: string | null;
  duration_months?: number | null;
} | null): string {
  if (!tariff) return "Spotify Premium";
  return formatSubsTariffDisplayLabel(tariff);
}

/** GPT-тарифы в каталоге — по умолчанию 1 мес. */
export function inferGptPlanDurationMonths(planId: string, planTitle?: string | null): number {
  return inferDurationMonthsFromText(planTitle) ?? inferDurationMonthsFromText(planId) ?? 1;
}
