export const SPOTIFY_STORE_BRAND = "SPOTIFY STORE";

/** Нормализует старые подписи Subs Store / хвост GPT STORE в SEO и UI. */
export function normalizeSpotifyStoreLabel(text: string): string {
  return text
    .replace(/Subs\s*Store/gi, SPOTIFY_STORE_BRAND)
    .replace(/\s*\|\s*GPT\s*STORE\s*$/gi, "")
    .replace(/\s*—\s*GPT\s*STORE\s*$/gi, "")
    .trim();
}

export function defaultSpotifySeoTitle(): string {
  return `${SPOTIFY_STORE_BRAND} — Spotify Premium в России`;
}
