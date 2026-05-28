import type { SiteSlug } from "@/lib/auth/siteUiSession";

export type DevStoreProfile = SiteSlug;

/** Профиль dev-сервера из `DEV_STORE_PROFILE` (задаётся в run-next-dev-*-port.js). */
export function getDevStoreProfileFromEnv(): DevStoreProfile | null {
  const p = process.env.DEV_STORE_PROFILE?.trim();
  if (p === "gpt-store" || p === "subs-store") return p;
  return null;
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
  if (port === "3056") return true;
  return getDevStoreProfileFromEnv() === "gpt-store";
}

export function isSubsDevPort(port: string | null | undefined): boolean {
  if (port === "3055") return true;
  return getDevStoreProfileFromEnv() === "subs-store";
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

  const siteDirect = params.siteDirect?.trim() ?? "";
  if (siteDirect === "subs-store" || siteDirect === "gpt-store") {
    return siteDirect;
  }

  if (isGptDevPort(port)) return "gpt-store";
  if (isSubsDevPort(port)) return "subs-store";

  if (pathname.startsWith("/spotify") || pathname.startsWith("/checkout/spotify")) {
    return "subs-store";
  }

  const returnUrl = params.returnUrl ?? "";

  /** Страница нового пароля: returnUrl только для редиректа после save, не для бренда. */
  if (pathname.startsWith("/reset-password/update")) {
    const cookie = params.cookieSite?.trim();
    if (cookie === "subs-store" || cookie === "gpt-store") return cookie;
    return "gpt-store";
  }

  const isAuthPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/callback");

  if (isAuthPath) {
    if (returnUrl.includes("site=subs-store")) return "subs-store";
    if (returnUrl.includes("site=gpt-store")) return "gpt-store";
    const cookie = params.cookieSite?.trim();
    if (cookie === "subs-store" || cookie === "gpt-store") return cookie;
    if (
      returnUrl.includes("/spotify") ||
      returnUrl.startsWith("/spotify")
    ) {
      return "subs-store";
    }
    return "gpt-store";
  }

  if (
    returnUrl.includes("site=subs-store") ||
    returnUrl.includes("/spotify") ||
    returnUrl.startsWith("/spotify")
  ) {
    return "subs-store";
  }

  const cookie = params.cookieSite?.trim();
  if (cookie === "subs-store" || cookie === "gpt-store") {
    return cookie;
  }

  return "gpt-store";
}
