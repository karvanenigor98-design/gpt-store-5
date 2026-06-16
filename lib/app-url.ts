const FALLBACK_ORIGIN = "https://gptplus-store.ru";
const FALLBACK_SPOTIFY_ORIGIN = "https://spotify-store.ru";

/**
 * Безопасный базовый URL для metadataBase, sitemap, JSON-LD.
 * Пустая строка или `localhost:3000` без протокола больше не роняют сборку.
 */
function isLocalHostname(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.endsWith(".local") ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h)
  );
}

function originFromEnvValue(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, "")}`;

  try {
    const u = new URL(withProtocol);
    if (isLocalHostname(u.hostname)) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function getPublicSiteOrigin(): string {
  const fromPublic =
    originFromEnvValue(process.env.NEXT_PUBLIC_GPT_SITE_URL) ||
    originFromEnvValue(process.env.NEXT_PUBLIC_GPT_STORE_URL) ||
    originFromEnvValue(process.env.NEXT_PUBLIC_APP_URL);
  if (fromPublic) return fromPublic;
  return FALLBACK_ORIGIN;
}

export function getPublicSpotifySiteOrigin(): string {
  const fromPublic =
    originFromEnvValue(process.env.NEXT_PUBLIC_SPOTIFY_SITE_URL) ||
    originFromEnvValue(process.env.NEXT_PUBLIC_SPOTIFY_STORE_URL) ||
    originFromEnvValue(process.env.NEXT_PUBLIC_SUBS_STORE_URL);
  if (fromPublic) return fromPublic;
  return FALLBACK_SPOTIFY_ORIGIN;
}

/**
 * Для API (Pally, webhooks): читает APP_URL в runtime, не NEXT_PUBLIC (тот может
 * быть заинлайнен при сборке как http://127.0.0.1:3055).
 */
export function getServerSiteOrigin(): string {
  const fromServer =
    originFromEnvValue(process.env.GPT_SITE_URL) ||
    originFromEnvValue(process.env.NEXT_PUBLIC_GPT_SITE_URL) ||
    originFromEnvValue(process.env.NEXT_PUBLIC_GPT_STORE_URL) ||
    originFromEnvValue(process.env.APP_URL) ||
    originFromEnvValue(process.env.SITE_URL);

  if (fromServer) return fromServer;

  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    return FALLBACK_ORIGIN;
  }

  return getPublicSiteOrigin();
}

export function getServerSiteOriginBySlug(siteSlug: "gpt-store" | "subs-store"): string {
  if (siteSlug === "subs-store") {
    return (
      originFromEnvValue(process.env.SPOTIFY_SITE_URL) ||
      originFromEnvValue(process.env.NEXT_PUBLIC_SPOTIFY_SITE_URL) ||
      originFromEnvValue(process.env.NEXT_PUBLIC_SPOTIFY_STORE_URL) ||
      originFromEnvValue(process.env.NEXT_PUBLIC_SUBS_STORE_URL) ||
      FALLBACK_SPOTIFY_ORIGIN
    );
  }
  return getServerSiteOrigin();
}

function normalizeStoreHostname(host: string): string {
  return host.toLowerCase().split(":")[0];
}

/** Origin для Pally bill/create: домен запроса, если это известный storefront. */
export function getPallyAppUrlFromRequest(
  request: { headers: { get(name: string): string | null } },
  siteSlug: "gpt-store" | "subs-store",
): string {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = normalizeStoreHostname(forwarded || request.headers.get("host") || "");

  if (siteSlug === "subs-store") {
    if (host === "spotify-store.ru" || host === "www.spotify-store.ru") {
      return FALLBACK_SPOTIFY_ORIGIN;
    }
  } else if (host === "gptplus-store.ru" || host === "www.gptplus-store.ru") {
    return FALLBACK_ORIGIN;
  }

  return getServerSiteOriginBySlug(siteSlug);
}

export function getMetadataBase(): URL {
  return new URL(getPublicSiteOrigin());
}
