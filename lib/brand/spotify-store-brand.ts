export const SPOTIFY_STORE_BRAND = "SPOTIFY STORE";

/** Для og:title / Telegram-превью — читаемее, чем ALL CAPS. */
export const SPOTIFY_STORE_LINK_NAME = "Spotify Store";

/** Нормализует старые подписи Subs Store / хвост GPT STORE в SEO и UI. */
export function normalizeSpotifyStoreLabel(text: string): string {
  return text
    .replace(/Subs\s*Store/gi, SPOTIFY_STORE_LINK_NAME)
    .replace(/\bSPOTIFY\s+STORE\b/gi, SPOTIFY_STORE_LINK_NAME)
    .replace(/\s*\|\s*GPT\s*STORE\s*$/gi, "")
    .replace(/\s*—\s*GPT\s*STORE\s*$/gi, "")
    .trim();
}

export function defaultSpotifySeoTitle(): string {
  return `${SPOTIFY_STORE_LINK_NAME} — Spotify Premium в России`;
}
