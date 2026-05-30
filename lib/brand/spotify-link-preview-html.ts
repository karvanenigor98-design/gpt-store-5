import {
  defaultSpotifySeoTitle,
  SPOTIFY_STORE_LINK_NAME,
} from "@/lib/brand/spotify-store-brand";

export const SPOTIFY_LINK_PREVIEW_DESCRIPTION =
  "Подключение Spotify Premium в России с оплатой в рублях, поддержкой и гарантией. Индивидуальные тарифы, Premium для двоих и Family.";

const PREVIEW_BOT_RE =
  /TelegramBot|Twitterbot|facebookexternalhit|WhatsApp|LinkedInBot|Slackbot|Discordbot|vkShare|Viber/i;

export function isLinkPreviewBot(userAgent: string | null | undefined): boolean {
  return PREVIEW_BOT_RE.test(userAgent ?? "");
}

/** Минимальный HTML для Telegram/Twitter — без RSC payload и FAQ из БД. */
export function buildSpotifyLinkPreviewHtml(origin: string): string {
  const pageUrl = `${origin.replace(/\/$/, "")}/spotify`;
  const title = defaultSpotifySeoTitle();
  const description = SPOTIFY_LINK_PREVIEW_DESCRIPTION;
  const updatedAt = new Date().toISOString();

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(description)}" />
  <link rel="canonical" href="${escapeAttr(pageUrl)}" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="ru_RU" />
  <meta property="og:url" content="${escapeAttr(pageUrl)}" />
  <meta property="og:site_name" content="${escapeAttr(SPOTIFY_STORE_LINK_NAME)}" />
  <meta property="og:title" content="${escapeAttr(title)}" />
  <meta property="og:description" content="${escapeAttr(description)}" />
  <meta property="og:updated_time" content="${escapeAttr(updatedAt)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(title)}" />
  <meta name="twitter:description" content="${escapeAttr(description)}" />
  <meta http-equiv="refresh" content="0;url=${escapeAttr(pageUrl)}" />
</head>
<body>
  <p><a href="${escapeAttr(pageUrl)}">${escapeHtml(title)}</a></p>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
