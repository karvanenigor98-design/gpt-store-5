import type { SiteIconSlug } from "@/lib/brand/site-icons";

const GPT_YANDEX_VERIFICATION_FALLBACK = "cd9de2df2aae5a87";

export function getYandexSiteVerification(site: SiteIconSlug): string | undefined {
  if (site === "subs-store") {
    return process.env.NEXT_PUBLIC_YANDEX_SPOTIFY_SITE_VERIFICATION?.trim() || undefined;
  }

  return (
    process.env.NEXT_PUBLIC_YANDEX_SITE_VERIFICATION?.trim() || GPT_YANDEX_VERIFICATION_FALLBACK
  );
}
