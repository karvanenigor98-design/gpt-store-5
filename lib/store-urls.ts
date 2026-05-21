import { getPublicSiteOrigin } from "@/lib/app-url";
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
  const fromEnv = normalizeOrigin(process.env.NEXT_PUBLIC_GPT_STORE_URL);
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === "development") {
    return "http://127.0.0.1:3056";
  }

  return getPublicSiteOrigin();
}

/** Полный URL лендинга Subs Store. */
export function getSubsStoreLandingUrl(): string {
  const fromEnv = normalizeOrigin(process.env.NEXT_PUBLIC_SUBS_STORE_URL);
  if (fromEnv) {
    const u = new URL(fromEnv);
    if (u.pathname === "/" || u.pathname === "") {
      return `${u.origin}/spotify`;
    }
    return u.href.replace(/\/$/, "");
  }

  if (process.env.NODE_ENV === "development") {
    return "http://127.0.0.1:3055/spotify";
  }

  const origin = getPublicSiteOrigin();
  return `${origin}/spotify`;
}

/** Относительный путь лендинга — /gpt работает на любом dev-порту (корень / на :3055 уходит в Subs). */
export function getGptStoreLandingPath(): string {
  return "/gpt";
}

export function getSubsStoreLandingPath(): string {
  return getSiteBySlug("subs-store").landingPath;
}
