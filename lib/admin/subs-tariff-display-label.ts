const CATEGORY_LABELS: Record<string, string> = {
  individual: "Individual",
  duo: "Duo",
  family: "Family",
};

export function formatSubsDurationLabel(months: number | null | undefined): string {
  if (months == null || months <= 0 || months === 1) return "1 мес";
  if (months === 12) return "12 мес";
  return `${months} мес`;
}

function looksLikeSlugOrUuid(value: string): boolean {
  const s = value.trim();
  if (!s) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s)) return true;
  if (/^spotify-/i.test(s)) return true;
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/i.test(s) && !s.includes(" ")) return true;
  return false;
}

export function buildSubsTariffDefaultTitle(
  category: string | null | undefined,
  durationMonths: number | null | undefined,
): string {
  const catKey = (category ?? "individual").trim().toLowerCase();
  const cat = CATEGORY_LABELS[catKey] ?? "Premium";
  const dur = formatSubsDurationLabel(durationMonths);
  return `Spotify ${cat} · ${dur}`;
}

/** Человекочитаемое название тарифа для админки и списка клиентов. */
export function formatSubsTariffDisplayLabel(tariff: {
  title?: string | null;
  slug?: string | null;
  category?: string | null;
  duration_months?: number | null;
}): string {
  const title = tariff.title?.trim();
  if (title && !looksLikeSlugOrUuid(title)) return title;
  return buildSubsTariffDefaultTitle(tariff.category, tariff.duration_months);
}

export function getSubsCategoryLabelRu(category: string | null | undefined): string {
  const key = (category ?? "individual").trim().toLowerCase();
  if (key === "duo") return "Spotify Duo";
  if (key === "family") return "Spotify Family";
  return "Spotify Individual";
}
