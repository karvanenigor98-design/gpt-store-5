import type { Metadata } from "next";
import { getPublicSpotifySiteOrigin } from "@/lib/app-url";
import { buildSiteIconsMetadata } from "@/lib/brand/site-icons";
import { defaultSpotifySeoTitle } from "@/lib/brand/spotify-store-brand";
import { SPOTIFY_LINK_PREVIEW_DESCRIPTION } from "@/lib/brand/spotify-link-preview-html";

const SPOTIFY_TITLE = defaultSpotifySeoTitle();

export const metadata: Metadata = {
  title: { absolute: "SPOTIFY STORE" },
  description: SPOTIFY_LINK_PREVIEW_DESCRIPTION,
  metadataBase: new URL(getPublicSpotifySiteOrigin()),
  manifest: "/api/manifest?site=subs-store",
  icons: buildSiteIconsMetadata("subs-store"),
  applicationName: "SPOTIFY STORE",
  openGraph: {
    title: SPOTIFY_TITLE,
    description: SPOTIFY_LINK_PREVIEW_DESCRIPTION,
    images: [{ url: "/icons/spotify/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SPOTIFY_TITLE,
    description: SPOTIFY_LINK_PREVIEW_DESCRIPTION,
    images: ["/icons/spotify/og-image.png"],
  },
  other: {
    "theme-color": "#1DB954",
  },
};

export default function SpotifySectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
