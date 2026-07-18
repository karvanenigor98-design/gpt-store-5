const CATEGORY_LABELS: Record<string, string> = {
  individual: "Individual",
  duo: "Duo",
  family: "Family",
};

/** Infer duration from slug like spotify-ind-3m / spotify-duo-12m. */
export function inferDurationMonthsFromSlug(slug: string | null | undefined): number | null {
  if (!slug) return null;
  const m = slug.trim().toLowerCase().match(/-(\d+)m$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function formatSubsDurationLabel(months: number | null | undefined): string {
  if (months == null || months <= 0) return "—";
  if (months === 1) return "1 мес";
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

/** «3 месяца», «12 месяцев», «мес» — не полноценное название тарифа. */
function isGenericDurationTitle(title: string): boolean {
  const t = title.trim().toLowerCase();
  return (
    /^\d+\s*(?:мес|месяц|месяца|месяцев|month)/.test(t) ||
    /^(год|12\s*мес)/.test(t) ||
    t === "мес" ||
    t === "месяц"
  );
}

function resolveDurationMonths(tariff: {
  slug?: string | null;
  title?: string | null;
  duration_months?: number | null;
}): number | null {
  if (tariff.duration_months != null && tariff.duration_months > 0) {
    return tariff.duration_months;
  }
  const fromSlug = inferDurationMonthsFromSlug(tariff.slug);
  if (fromSlug) return fromSlug;
  const title = tariff.title?.trim().toLowerCase() ?? "";
  const numbered = title.match(/(\d+)\s*(?:мес|месяц|месяца|месяцев|month)/);
  if (numbered) {
    const n = Number(numbered[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (/год/.test(title)) return 12;
  return null;
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
  if (title && !looksLikeSlugOrUuid(title) && !isGenericDurationTitle(title)) return title;
  const months = resolveDurationMonths(tariff);
  return buildSubsTariffDefaultTitle(tariff.category, months);
}

export function getSubsCategoryLabelRu(category: string | null | undefined): string {
  const key = (category ?? "individual").trim().toLowerCase();
  if (key === "duo") return "Spotify Duo";
  if (key === "family") return "Spotify Family";
  return "Spotify Individual";
}

/** Email/Telegram: Spotify Premium — Individual — 1 месяц */
export function formatSubsTariffEmailLabel(tariff: {
  title?: string | null;
  slug?: string | null;
  category?: string | null;
  duration_months?: number | null;
}): string {
  const catKey = (tariff.category ?? "").trim().toLowerCase();
  const cat =
    catKey === "duo" ? "Duo"
    : catKey === "family" ? "Family"
    : catKey === "individual" || !catKey ? "Individual"
    : catKey.charAt(0).toUpperCase() + catKey.slice(1);

  const months = resolveDurationMonths(tariff);
  let duration = "срок не указан";
  if (months === 1) duration = "1 месяц";
  else if (months === 3) duration = "3 месяца";
  else if (months === 6) duration = "6 месяцев";
  else if (months === 12) duration = "12 месяцев";
  else if (months != null && months > 0) duration = `${months} мес`;

  // Если category пустой, но title уже полный — не выдумываем.
  const title = tariff.title?.trim();
  if (!catKey && title && !isGenericDurationTitle(title) && !looksLikeSlugOrUuid(title)) {
    return title;
  }

  return `Spotify Premium — ${cat} — ${duration}`;
}
