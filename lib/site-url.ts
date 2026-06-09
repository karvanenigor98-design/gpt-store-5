import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";
import { defaultCustomerDashboard } from "@/lib/auth/authReturnUrl";

const PROD_BASE_URL = "https://gpt-store-5.vercel.app";
const LOCAL_BASE_URL = "http://127.0.0.1:3055";

function normalizeAbsoluteUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, "")}`;
  try {
    return new URL(withProtocol).href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function normalizeOrigin(raw: string | null | undefined): string | null {
  const absolute = normalizeAbsoluteUrl(raw);
  if (!absolute) return null;
  return new URL(absolute).origin;
}

function isLocalOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

function normalizeProductionOrigin(raw: string | null | undefined): string | null {
  const origin = normalizeOrigin(raw);
  if (!origin || isLocalOrigin(origin)) return null;
  return origin;
}

function hostnameMatchesConfiguredStore(hostname: string, storeUrl: string | null | undefined): boolean {
  const normalized = normalizeAbsoluteUrl(storeUrl);
  if (!normalized) return false;
  const storeHost = new URL(normalized).hostname.toLowerCase();
  const h = hostname.toLowerCase();
  if (h === storeHost) return true;
  if (h === `www.${storeHost}`) return true;
  if (storeHost.startsWith("www.") && h === storeHost.slice(4)) return true;
  return false;
}

export function isSpotifyStoreHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "spotify-store.ru" || h === "www.spotify-store.ru") return true;
  return (
    hostnameMatchesConfiguredStore(hostname, process.env.NEXT_PUBLIC_SPOTIFY_STORE_URL) ||
    hostnameMatchesConfiguredStore(hostname, process.env.NEXT_PUBLIC_SUBS_STORE_URL)
  );
}

export function getBaseUrl(runtimeOrigin?: string): string {
  if (process.env.NODE_ENV !== "production") {
    if (runtimeOrigin) {
      const fromRuntime = normalizeOrigin(runtimeOrigin);
      if (fromRuntime) return fromRuntime;
    }
    if (typeof window !== "undefined") {
      return window.location.origin.replace(/\/$/, "");
    }
    const local = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
    return local ?? LOCAL_BASE_URL;
  }

  const fromEnv =
    normalizeProductionOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeProductionOrigin(process.env.NEXT_PUBLIC_GPT_STORE_URL);

  const fromRuntime = normalizeProductionOrigin(runtimeOrigin);

  const fromVercel =
    normalizeProductionOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeProductionOrigin(process.env.VERCEL_URL);

  const resolved = fromEnv ?? fromRuntime ?? fromVercel ?? PROD_BASE_URL;
  if (isLocalOrigin(resolved)) return PROD_BASE_URL;
  return resolved;
}

/** В браузере — текущий origin (чтобы email-ссылки не уходили на localhost из build-time env). */
export function getClientRuntimeOrigin(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const origin = normalizeOrigin(window.location.origin);
  if (!origin) return undefined;
  if (process.env.NODE_ENV === "production" && isLocalOrigin(origin)) return undefined;
  return origin;
}

export function getSiteBaseUrl(site: AuthSiteSlug, runtimeOrigin?: string): string {
  if (site === "subs-store") {
    const spotifyUrl =
      normalizeAbsoluteUrl(process.env.NEXT_PUBLIC_SPOTIFY_STORE_URL) ??
      normalizeAbsoluteUrl(process.env.NEXT_PUBLIC_SUBS_STORE_URL);
    if (spotifyUrl) {
      const parsed = new URL(spotifyUrl);
      const pathname = parsed.pathname.replace(/\/$/, "");
      return pathname && pathname !== "/" ? `${parsed.origin}${pathname}` : `${parsed.origin}/spotify`;
    }
    return `${getBaseUrl(runtimeOrigin)}/spotify`;
  }

  const gpt = normalizeAbsoluteUrl(process.env.NEXT_PUBLIC_GPT_STORE_URL);
  if (gpt) {
    const parsed = new URL(gpt);
    return parsed.origin;
  }
  return getBaseUrl(runtimeOrigin);
}

/** Origin для auth/email-ссылок (без /spotify в path). */
export function getSiteOrigin(site: AuthSiteSlug, runtimeOrigin?: string): string {
  if (site === "subs-store") {
    const spotifyUrl =
      normalizeAbsoluteUrl(process.env.NEXT_PUBLIC_SPOTIFY_STORE_URL) ??
      normalizeAbsoluteUrl(process.env.NEXT_PUBLIC_SUBS_STORE_URL);
    if (spotifyUrl) return new URL(spotifyUrl).origin;
    return getBaseUrl(runtimeOrigin);
  }
  return getSiteBaseUrl(site, runtimeOrigin);
}

export function getAuthCallbackUrl(site: AuthSiteSlug, returnUrl?: string, runtimeOrigin?: string): string {
  const url = new URL("/auth/callback", getSiteOrigin(site, runtimeOrigin));
  url.searchParams.set("site", site);
  if (returnUrl) {
    const safeReturn =
      returnUrl.startsWith("/") && !returnUrl.startsWith("//") ? returnUrl.split("?")[0] || returnUrl : returnUrl;
    url.searchParams.set("returnUrl", safeReturn);
  }
  return url.toString();
}

/**
 * redirectTo для Supabase resetPasswordForEmail / generateLink.
 * /callback — клиент подхватывает #hash и PKCE, затем ведёт на /reset-password/update.
 */
export function buildRecoveryRedirectTo(site: AuthSiteSlug, runtimeOrigin?: string): string {
  return buildRecoveryCallbackRedirectTo(site, runtimeOrigin);
}

/**
 * redirectTo для signUp / resend signup.
 * /auth/callback — серверный verifyOtp(token_hash) работает на любом устройстве;
 * /callback остаётся для #access_token из implicit-ссылок.
 */
export function buildSignupRedirectTo(
  site: AuthSiteSlug,
  returnUrl: string,
  runtimeOrigin?: string,
): string {
  const url = new URL("/auth/callback", getSiteOrigin(site, runtimeOrigin));
  url.searchParams.set("type", "signup");
  url.searchParams.set("site", site);
  const safeReturn =
    returnUrl.startsWith("/") && !returnUrl.startsWith("//")
      ? returnUrl
      : defaultCustomerDashboard(site);
  url.searchParams.set("returnUrl", safeReturn);
  return url.toString();
}

/** redirectTo для recovery (Supabase resetPasswordForEmail / generateLink). */
export function buildRecoveryCallbackRedirectTo(site: AuthSiteSlug, runtimeOrigin?: string): string {
  const url = new URL("/auth/callback", getSiteOrigin(site, runtimeOrigin));
  url.searchParams.set("site", site);
  url.searchParams.set("type", "recovery");
  url.searchParams.set("returnUrl", defaultCustomerDashboard(site));
  return url.toString();
}

export function getCabinetUrl(site: AuthSiteSlug, runtimeOrigin?: string): string {
  const url = new URL("/cabinet", getSiteOrigin(site, runtimeOrigin));
  url.searchParams.set("site", site);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export function getLoginUrl(site: AuthSiteSlug, runtimeOrigin?: string): string {
  const url = new URL("/login", getSiteOrigin(site, runtimeOrigin));
  url.searchParams.set("site", site);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export function getVerifyEmailUrl(site: AuthSiteSlug, runtimeOrigin?: string): string {
  const url = new URL("/verify-email", getSiteOrigin(site, runtimeOrigin));
  if (site !== "gpt-store") url.searchParams.set("site", site);
  return `${url.pathname}${url.search}`;
}

export function getResetPasswordUrl(site: AuthSiteSlug, runtimeOrigin?: string): string {
  const url = new URL("/reset-password", getSiteOrigin(site, runtimeOrigin));
  if (site !== "gpt-store") url.searchParams.set("site", site);
  return `${url.pathname}${url.search}`;
}
