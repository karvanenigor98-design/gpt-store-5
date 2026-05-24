import { resolveAuthSiteContext } from "@/lib/auth/devStoreProfile";

export type AuthSiteSlug = "subs-store" | "gpt-store";

export function detectAuthSiteFromStrings(
  siteDirect: string,
  returnUrl: string,
  cookieSite?: string,
  pathname = "",
): AuthSiteSlug {
  return resolveAuthSiteContext({
    siteDirect,
    returnUrl,
    cookieSite,
    pathname,
  });
}
