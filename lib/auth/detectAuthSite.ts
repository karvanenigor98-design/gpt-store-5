import {
  resolveAuthSiteContext,
  resolveRecoveryAuthSite,
} from "@/lib/auth/devStoreProfile";

export type AuthSiteSlug = "subs-store" | "gpt-store";

export function detectAuthSiteFromStrings(
  siteDirect: string,
  returnUrl: string,
  cookieSite?: string,
  pathname = "",
  options?: { recoveryFlow?: boolean },
): AuthSiteSlug {
  return resolveAuthSiteContext({
    siteDirect,
    returnUrl,
    cookieSite,
    pathname,
    recoveryFlow: options?.recoveryFlow,
  });
}

export function detectRecoveryAuthSite(
  siteDirect: string,
  resetCookie?: string,
  port?: string | null,
): AuthSiteSlug {
  return resolveRecoveryAuthSite({
    siteDirect,
    resetCookie,
    port,
  });
}
