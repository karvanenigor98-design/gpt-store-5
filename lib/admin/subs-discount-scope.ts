/** Область скидки/промо Subs Store: tariff_slugs или fallback в description. */

export const TARIFF_SCOPE_PREFIX = "@tariff_scope:";

export function isMissingTariffSlugsColumn(message: string): boolean {
  const m = (message ?? "").toLowerCase();
  return (
    m.includes("tariff_slugs") &&
    (m.includes("schema cache") ||
      m.includes("does not exist") ||
      m.includes("could not find") ||
      m.includes("column"))
  );
}

export function encodeTariffScopeDescription(slugs: string[] | null, appliesTo?: string): string | null {
  if (appliesTo === "all" || appliesTo === "landing") return null;
  const list =
    slugs?.length ?
      slugs
    : (appliesTo ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  if (!list.length) return null;
  if (list.length === 1 && (list[0] === "all" || list[0] === "landing")) return null;
  return `${TARIFF_SCOPE_PREFIX}${list.join(",")}`;
}

export function parseTariffSlugsFromRow(row: {
  tariff_slugs?: string[] | null;
  description?: string | null;
}): string[] | null {
  if (row.tariff_slugs?.length) return row.tariff_slugs;

  const d = row.description?.trim() ?? "";
  if (d.startsWith(TARIFF_SCOPE_PREFIX)) {
    const rest = d.slice(TARIFF_SCOPE_PREFIX.length).trim();
    if (!rest || rest === "all" || rest === "landing") return null;
    return rest
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const legacy = d.match(/^Область:\s*(.+)$/i);
  if (legacy?.[1]) {
    const part = legacy[1].trim();
    if (part && part !== "all" && part !== "landing") {
      return part
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  return null;
}

export function appliesToFromSlugs(slugs: string[] | null): string {
  if (!slugs?.length) return "all";
  return slugs.length === 1 ? slugs[0]! : slugs.join(",");
}
