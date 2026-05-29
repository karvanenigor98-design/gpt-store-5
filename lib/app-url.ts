const FALLBACK_ORIGIN = "https://gpt-store-5.vercel.app";

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
  const fromPublic = originFromEnvValue(process.env.NEXT_PUBLIC_APP_URL);
  if (fromPublic) return fromPublic;
  return FALLBACK_ORIGIN;
}

/**
 * Для API (Pally, webhooks): читает APP_URL в runtime, не NEXT_PUBLIC (тот может
 * быть заинлайнен при сборке как http://127.0.0.1:3055).
 */
export function getServerSiteOrigin(): string {
  const fromServer =
    originFromEnvValue(process.env.APP_URL) ||
    originFromEnvValue(process.env.SITE_URL);

  if (fromServer) return fromServer;

  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    return FALLBACK_ORIGIN;
  }

  return getPublicSiteOrigin();
}

export function getMetadataBase(): URL {
  return new URL(getPublicSiteOrigin());
}
