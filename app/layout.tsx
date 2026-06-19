import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { Unbounded, Golos_Text } from "next/font/google";
import { cn } from "@/lib/utils";
import { getPublicSiteOrigin, getPublicSpotifySiteOrigin } from "@/lib/app-url";
import { CookieBanner } from "@/components/ui/CookieBanner";
import { SubsStoreYandexMetrika } from "@/components/analytics/SubsStoreYandexMetrika";
import { YandexMetrika } from "@/components/analytics/YandexMetrika";
import { ReferralCapture } from "@/components/referrals/ReferralCapture";
import "./globals.css";

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-unbounded",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const golos = Golos_Text({
  subsets: ["latin", "cyrillic"],
  variable: "--font-golos",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

type SiteMetaContext = "gpt-store" | "subs-store";

async function resolveMetadataContext(): Promise<SiteMetaContext> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase();
  if (host.includes("spotify-store.ru")) return "subs-store";

  const pathname = h.get("x-invoke-pathname") ?? "";
  if (pathname.startsWith("/spotify") || pathname.startsWith("/checkout/spotify")) {
    return "subs-store";
  }

  const search = h.get("x-invoke-search") ?? "";
  try {
    const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    if (sp.get("site") === "subs-store") return "subs-store";
  } catch {
    /* noop */
  }

  return "gpt-store";
}

function iconsFor(site: SiteMetaContext) {
  const base = site === "subs-store" ? "/icons/spotify" : "/icons/gpt";
  return {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: `${base}/favicon.ico`, type: "image/x-icon" },
      { url: `${base}/favicon-32x32.png`, sizes: "32x32", type: "image/png" },
      { url: `${base}/icon-192.png`, sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: `${base}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const site = await resolveMetadataContext();
  const isSpotify = site === "subs-store";

  const title = isSpotify ? "SPOTIFY STORE" : "GPT STORE";
  const description = isSpotify
    ? "Spotify Premium: подключение подписки и безопасная оплата."
    : "Подписка ChatGPT Plus/Pro в России, безопасная оплата и быстрое подключение.";
  const ogImage = isSpotify ? "/icons/spotify/og-image.png" : "/icons/gpt/og-image.png";

  return {
    title: { default: title, template: `%s | ${title}` },
    description,
    metadataBase: new URL(isSpotify ? getPublicSpotifySiteOrigin() : getPublicSiteOrigin()),
    manifest: `/api/manifest?site=${site}`,
    icons: iconsFor(site),
    applicationName: title,
    openGraph: {
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    other: {
      "theme-color": isSpotify ? "#1DB954" : "#10a37f",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={cn(unbounded.variable, golos.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-white font-sans text-foreground antialiased">
        <div className="relative" style={{ zIndex: 1 }}>
          <Suspense fallback={null}>
            <ReferralCapture />
          </Suspense>
          {children}
        </div>
        <Suspense fallback={null}>
          <CookieBanner />
          <YandexMetrika />
          <SubsStoreYandexMetrika />
        </Suspense>
      </body>
    </html>
  );
}
