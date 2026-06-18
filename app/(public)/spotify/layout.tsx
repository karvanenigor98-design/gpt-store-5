import type { Metadata } from "next";
import { getMetadataBase } from "@/lib/app-url";
import { defaultSpotifySeoTitle } from "@/lib/brand/spotify-store-brand";
import { SPOTIFY_LINK_PREVIEW_DESCRIPTION } from "@/lib/brand/spotify-link-preview-html";

const SPOTIFY_TITLE = defaultSpotifySeoTitle();

export const metadata: Metadata = {
  title: { absolute: "SPOTIFY STORE" },
  description: SPOTIFY_LINK_PREVIEW_DESCRIPTION,
  metadataBase: getMetadataBase(),
  manifest: "/api/manifest?site=subs-store",
  icons: {
    icon: [
      { url: "/icons/spotify/favicon.ico", type: "image/x-icon" },
      { url: "/icons/spotify/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/spotify/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/spotify/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icons/spotify/favicon.ico"],
  },
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
