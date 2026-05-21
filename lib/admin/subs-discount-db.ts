import type { SupabaseClient } from "@supabase/supabase-js";

import {
  encodeTariffScopeDescription,
  isMissingTariffSlugsColumn,
} from "@/lib/admin/subs-discount-scope";

type SubsAdmin = SupabaseClient;

export async function insertSubsDiscount(
  subs: SubsAdmin,
  input: {
    title: string;
    type: "percent" | "fixed";
    value: number;
    appliesTo: string;
    tariffSlugs: string[] | null;
    starts_at: string | null;
    ends_at: string | null;
    is_active: boolean;
  },
) {
  const scopeDesc = encodeTariffScopeDescription(input.tariffSlugs, input.appliesTo);
  const base: Record<string, unknown> = {
    title: input.title,
    description: scopeDesc,
    type: input.type,
    value: input.value,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    is_active: input.is_active,
  };

  if (input.tariffSlugs?.length) {
    const withSlugs = { ...base, tariff_slugs: input.tariffSlugs };
    const first = await subs.from("discounts").insert(withSlugs).select("*").single();
    if (!first.error) return first;
    if (!isMissingTariffSlugsColumn(first.error.message)) return first;
  }

  return subs.from("discounts").insert(base).select("*").single();
}

export async function updateSubsDiscount(
  subs: SubsAdmin,
  id: string,
  patchSubs: Record<string, unknown>,
  opts?: { tariffSlugs?: string[] | null; appliesTo?: string },
) {
  const withSlugs = { ...patchSubs };
  if (opts?.tariffSlugs !== undefined) {
    if (opts.tariffSlugs?.length) {
      withSlugs.tariff_slugs = opts.tariffSlugs;
      withSlugs.description = encodeTariffScopeDescription(opts.tariffSlugs, opts.appliesTo);
    } else {
      withSlugs.tariff_slugs = null;
      withSlugs.description = null;
    }
  }

  const first = await subs.from("discounts").update(withSlugs).eq("id", id).select("*").single();
  if (!first.error) return first;
  if (!isMissingTariffSlugsColumn(first.error.message)) return first;

  const fallback = { ...patchSubs };
  delete fallback.tariff_slugs;
  if (opts?.tariffSlugs !== undefined) {
    fallback.description = encodeTariffScopeDescription(opts.tariffSlugs, opts.appliesTo);
  }
  return subs.from("discounts").update(fallback).eq("id", id).select("*").single();
}

export async function insertSubsPromocode(
  subs: SubsAdmin,
  row: Record<string, unknown>,
  planIds: string[] | null,
) {
  if (planIds?.length) {
    const withSlugs = { ...row, tariff_slugs: planIds };
    const first = await subs.from("promocodes").insert(withSlugs).select("*").single();
    if (!first.error) return first;
    if (!isMissingTariffSlugsColumn(first.error.message)) return first;
  }

  const without = { ...row };
  delete without.tariff_slugs;
  return subs.from("promocodes").insert(without).select("*").single();
}

export async function fetchSubsDiscounts(subs: SubsAdmin) {
  const full = await subs
    .from("discounts")
    .select("id,title,type,value,tariff_slugs,starts_at,ends_at,is_active,description");

  if (!full.error) return full;

  if (isMissingTariffSlugsColumn(full.error.message)) {
    return subs
      .from("discounts")
      .select("id,title,type,value,starts_at,ends_at,is_active,description");
  }

  return full;
}

export async function updateSubsPromocode(
  subs: SubsAdmin,
  id: string,
  patchSubs: Record<string, unknown>,
  planIds?: string[] | null,
) {
  const withSlugs = { ...patchSubs };
  if (planIds !== undefined) {
    withSlugs.tariff_slugs = planIds?.length ? planIds : null;
  }

  const first = await subs.from("promocodes").update(withSlugs).eq("id", id).select("*").single();
  if (!first.error) return first;
  if (planIds === undefined || !isMissingTariffSlugsColumn(first.error.message)) return first;

  const fallback = { ...patchSubs };
  delete fallback.tariff_slugs;
  return subs.from("promocodes").update(fallback).eq("id", id).select("*").single();
}

export async function incrementSubsPromocodeUsage(
  subs: SubsAdmin,
  codeFromMeta: string | null | undefined,
) {
  const raw = codeFromMeta?.trim();
  if (!raw) return;
  const code = raw.toUpperCase();

  const { data: row } = await subs
    .from("promocodes")
    .select("id, used_count, max_uses")
    .eq("code", code)
    .maybeSingle();

  if (!row) return;
  const used = Number(row.used_count ?? 0);
  if (row.max_uses != null && used >= row.max_uses) return;

  await subs
    .from("promocodes")
    .update({ used_count: used + 1 })
    .eq("id", row.id);
}

export async function fetchSubsPromocodes(subs: SubsAdmin) {
  const full = await subs
    .from("promocodes")
    .select("id,code,type,value,max_uses,used_count,tariff_slugs,expires_at,is_active");

  if (!full.error) return full;

  if (isMissingTariffSlugsColumn(full.error.message)) {
    return subs.from("promocodes").select("id,code,type,value,max_uses,used_count,expires_at,is_active");
  }

  return full;
}
