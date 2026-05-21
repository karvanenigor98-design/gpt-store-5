export type AuthSiteSlug = "subs-store" | "gpt-store";

export function detectAuthSiteFromStrings(
  siteDirect: string,
  returnUrl: string,
  cookieSite?: string,
): AuthSiteSlug {
  if (siteDirect === "subs-store") return "subs-store";
  if (cookieSite === "subs-store") return "subs-store";
  if (
    returnUrl.includes("site=subs-store") ||
    returnUrl.includes("/spotify") ||
    returnUrl.startsWith("/spotify")
  ) {
    return "subs-store";
  }
  return "gpt-store";
}
