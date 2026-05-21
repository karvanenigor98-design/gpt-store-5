/** Нормализация строк Subs Store → форма, ожидаемая GPT STORE админ-UI (PromocodesManager / DiscountsManager). */

import { appliesToFromSlugs, parseTariffSlugsFromRow } from "@/lib/admin/subs-discount-scope";

export function mapSubsPromocodeToUiRow(row: {
  id: string;
  code: string;
  type: string;
  value: number;
  max_uses: number | null;
  used_count: number | null;
  expires_at: string | null;
  is_active: boolean | null;
  tariff_slugs?: string[] | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}) {
  const slugs = parseTariffSlugsFromRow(row);
  return {
    id: row.id,
    code: row.code,
    discount_type: (row.type === "fixed" ? "fixed" : "percent") as "percent" | "fixed",
    discount_value: Number(row.value ?? 0),
    plan_ids: slugs,
    max_uses: row.max_uses,
    uses_count: Number(row.used_count ?? 0),
    valid_from: null as string | null,
    valid_until: row.expires_at,
    is_active: row.is_active !== false,
  };
}

export function mapSubsDiscountToUiRow(row: {
  id: string;
  title: string;
  type: string;
  value: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean | null;
  description?: string | null;
  tariff_slugs?: string[] | null;
}) {
  const slugs = parseTariffSlugsFromRow(row);
  return {
    id: row.id,
    name: row.title,
    discount_type: (row.type === "fixed" ? "fixed" : "percent") as "percent" | "fixed",
    discount_value: Number(row.value ?? 0),
    applies_to: appliesToFromSlugs(slugs),
    plan_ids: slugs,
    valid_from: row.starts_at,
    valid_until: row.ends_at,
    is_active: row.is_active !== false,
  };
}
