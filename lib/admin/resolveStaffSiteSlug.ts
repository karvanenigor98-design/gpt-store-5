export type StaffSiteSlug = "gpt-store" | "subs-store";

/** URL ?site= wins; otherwise localStorage / saved slug; default gpt-store. */
export function resolveStaffSiteSlug(
  searchParams: Pick<URLSearchParams, "get">,
  savedSlug?: string | null,
): StaffSiteSlug {
  const raw = searchParams.get("site");
  if (raw === "subs-store" || raw === "gpt-store") return raw;
  if (savedSlug === "subs-store" || savedSlug === "gpt-store") return savedSlug;
  return "gpt-store";
}
