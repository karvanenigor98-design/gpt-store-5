const FALLBACK_ORIGIN = "https://gpt-store-5.vercel.app";

/**
 * Безопасный базовый URL для metadataBase, sitemap, JSON-LD.
 * Пустая строка или `localhost:3000` без протокола больше не роняют сборку.
 */
export function getPublicSiteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return FALLBACK_ORIGIN;

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;

  try {
    const u = new URL(withProtocol);
    return u.origin;
  } catch {
    return FALLBACK_ORIGIN;
  }
}

export function getMetadataBase(): URL {
  return new URL(getPublicSiteOrigin());
}
