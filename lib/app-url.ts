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

/**
 * Origin для Pally bill/create.
 * Pally whitelist — только apex магазинов. www / *.vercel.app / APP_URL
 * дают api:error.url_not_allowed (гость на vercel.app тоже).
 */
export function getPallyAppUrlFromRequest(
  _request: { headers: { get(name: string): string | null } },
  siteSlug: "gpt-store" | "subs-store",
): string {
  return siteSlug === "subs-store" ? FALLBACK_SPOTIFY_ORIGIN : FALLBACK_ORIGIN;
}

export function getMetadataBase(): URL {
  return new URL(getPublicSiteOrigin());
}
