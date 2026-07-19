import { getPublicSiteOrigin, getPublicSpotifySiteOrigin } from "@/lib/app-url";
import { getSiteBySlug } from "@/lib/sites";

function normalizeOrigin(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`;
  try {
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

/** Полный URL лендинга GPT STORE (с учётом dev-портов и env). */
export function getGptStoreLandingUrl(): string {
  const fromEnv =
    normalizeOrigin(process.env.NEXT_PUBLIC_GPT_SITE_URL) ||
    normalizeOrigin(process.env.NEXT_PUBLIC_GPT_STORE_URL);
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === "development") {
    return "http://127.0.0.1:3056";
  }

  return getPublicSiteOrigin();
}

/** Полный URL лендинга Subs Store. */
export function getSubsStoreLandingUrl(): string {
  const fromEnv =
    normalizeOrigin(process.env.NEXT_PUBLIC_SPOTIFY_SITE_URL) ||
    normalizeOrigin(process.env.NEXT_PUBLIC_SPOTIFY_STORE_URL) ||
    normalizeOrigin(process.env.NEXT_PUBLIC_SUBS_STORE_URL);
  if (fromEnv) {
    const u = new URL(fromEnv);
    if (u.pathname === "/" || u.pathname === "") return u.origin;
    return `${u.origin}${u.pathname.replace(/\/$/, "")}`;
  }

  if (process.env.NODE_ENV === "development") {
    return "http://127.0.0.1:3055/spotify";
  }

  return getPublicSpotifySiteOrigin();
}

/** Относительный путь лендинга — /gpt работает на любом dev-порту (корень / на :3055 уходит в Subs). */
export function getGptStoreLandingPath(): string {
  return "/gpt";
}

export function getSubsStoreLandingPath(): string {
  return getSiteBySlug("subs-store").landingPath;
}

export type CrossStoreTarget = "gpt-store" | "subs-store";

/** Cross-sell: production → абсолютный URL другого домена; dev → относительный путь. */
export function getCrossStoreLandingHref(target: CrossStoreTarget): string {
  if (process.env.NODE_ENV === "production") {
    return target === "gpt-store" ? getGptStoreLandingUrl() : getSubsStoreLandingUrl();
  }
  return target === "gpt-store" ? getGptStoreLandingPath() : getSubsStoreLandingPath();
}

/** Нормализует ctaHref из админки/БД: относительные пути → абсолютные URL в production. */
export function resolveCrossStoreHref(href: string, target: CrossStoreTarget): string {
  const trimmed = href.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const gptPath = getGptStoreLandingPath();
  const subsPath = getSubsStoreLandingPath();

  if (process.env.NODE_ENV === "production") {
    if (target === "gpt-store" && (path === gptPath || path === `${gptPath}/`)) {
      return getGptStoreLandingUrl();
    }
    if (target === "subs-store" && (path === subsPath || path === `${subsPath}/`)) {
      return getSubsStoreLandingUrl();
    }
  }

  return path;
}
