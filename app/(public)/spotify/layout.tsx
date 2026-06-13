import type { Metadata } from "next";
import { getMetadataBase } from "@/lib/app-url";
import { defaultSpotifySeoTitle } from "@/lib/brand/spotify-store-brand";
import { SPOTIFY_LINK_PREVIEW_DESCRIPTION } from "@/lib/brand/spotify-link-preview-html";

const SPOTIFY_TITLE = defaultSpotifySeoTitle();

export const metadata: Metadata = {
  title: { absolute: SPOTIFY_TITLE },
  description: SPOTIFY_LINK_PREVIEW_DESCRIPTION,
  metadataBase: getMetadataBase(),
  manifest: "/api/manifest",
  icons: {
    icon: [
      { url: "/icon-spotify.svg", type: "image/svg+xml" },
      { url: "/favicon-spotify.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon-spotify.svg", type: "image/svg+xml" }],
    shortcut: ["/favicon-spotify.svg"],
  },
  applicationName: "SPOTIFY STORE",
};

export default function SpotifySectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
