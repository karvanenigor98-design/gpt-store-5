import type { SiteIconSlug } from "@/lib/brand/site-icons";
import { isGptStoreHostname, isSpotifyStoreHostname } from "@/lib/site-url";

const GPT_YANDEX_VERIFICATION_FALLBACK = "cd9de2df2aae5a87";

export function getYandexSiteVerification(site: SiteIconSlug): string | undefined {
  if (site === "subs-store") {
    return process.env.NEXT_PUBLIC_YANDEX_SPOTIFY_SITE_VERIFICATION?.trim() || undefined;
  }

  return (
    process.env.NEXT_PUBLIC_YANDEX_SITE_VERIFICATION?.trim() || GPT_YANDEX_VERIFICATION_FALLBACK
  );
}

/** Never attach GPT verification token to Spotify host (and vice versa). */
export function getYandexSiteVerificationForHost(
  site: SiteIconSlug,
  host: string,
): string | undefined {
  const normalizedHost = host.toLowerCase().split(":")[0];

  if (isSpotifyStoreHostname(normalizedHost)) {
    return getYandexSiteVerification("subs-store");
  }

  if (isGptStoreHostname(normalizedHost) || normalizedHost.endsWith(".vercel.app")) {
    return getYandexSiteVerification("gpt-store");
  }

  if (!normalizedHost) {
    return getYandexSiteVerification(site);
  }

  return undefined;
}
