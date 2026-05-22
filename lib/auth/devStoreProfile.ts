import type { SiteSlug } from "@/lib/auth/siteUiSession";

export type DevStoreProfile = SiteSlug;

/**
 * Профиль магазина: dev (`DEV_STORE_PROFILE`) или отдельный Vercel (`STORE_PROFILE`).
 * subs-store → лендинг на /spotify, gpt-store → лендинг на /.
 */
export function getStoreProfileFromEnv(): DevStoreProfile | null {
  const p =
    process.env.STORE_PROFILE?.trim() ||
    process.env.DEV_STORE_PROFILE?.trim() ||
    process.env.NEXT_PUBLIC_STORE_PROFILE?.trim();
  if (p === "gpt-store" || p === "subs-store") return p;
  return null;
}

/** @deprecated используй getStoreProfileFromEnv */
export function getDevStoreProfileFromEnv(): DevStoreProfile | null {
  return getStoreProfileFromEnv();
}

export function portFromHostHeader(host: string | null): string | null {
  if (!host?.includes(":")) return null;
  const port = host.split(":")[1]?.trim();
  return port || null;
}

export function resolvePortFromHeaders(headers: Headers): string | null {
  return portFromHostHeader(headers.get("host")) ?? headers.get("x-forwarded-port")?.trim() ?? null;
}

export function isGptDevPort(port: string | null | undefined): boolean {
  const profile = getStoreProfileFromEnv();
  if (profile === "gpt-store") return true;
  if (profile === "subs-store") return false;
  if (port === "3056") return true;
  return false;
}

export function isSubsDevPort(port: string | null | undefined): boolean {
  const profile = getStoreProfileFromEnv();
  if (profile === "subs-store") return true;
  if (profile === "gpt-store") return false;
  if (port === "3055") return true;
  return false;
}

/**
 * Какой магазин показывать в auth UI и в cookie `current_site`.
 * На :3056 всегда GPT, на :3055 — Subs (даже если в returnUrl есть subs-store на GPT-порту).
 */
export function resolveAuthSiteContext(params: {
  siteDirect?: string | null;
  returnUrl?: string | null;
  cookieSite?: string | null;
  port?: string | null;
  pathname?: string;
}): DevStoreProfile {
  const port = params.port ?? null;
  const pathname = params.pathname ?? "";

  if (isGptDevPort(port)) return "gpt-store";
  if (isSubsDevPort(port)) return "subs-store";

  if (pathname.startsWith("/spotify") || pathname.startsWith("/checkout/spotify")) {
    return "subs-store";
  }

  const siteDirect = params.siteDirect?.trim() ?? "";
  if (siteDirect === "subs-store" || siteDirect === "gpt-store") {
    return siteDirect;
  }

  const returnUrl = params.returnUrl ?? "";
  if (
    returnUrl.includes("site=subs-store") ||
    returnUrl.includes("/spotify") ||
    returnUrl.startsWith("/spotify")
  ) {
    return "subs-store";
  }

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password")
  ) {
    return "gpt-store";
  }

  const cookie = params.cookieSite?.trim();
  if (cookie === "subs-store" || cookie === "gpt-store") {
    return cookie;
  }

  return getStoreProfileFromEnv() ?? "gpt-store";
}
