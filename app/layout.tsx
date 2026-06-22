import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { Unbounded, Golos_Text } from "next/font/google";
import { cn } from "@/lib/utils";
import { getPublicSiteOrigin, getPublicSpotifySiteOrigin } from "@/lib/app-url";
import { buildSiteIconsMetadata } from "@/lib/brand/site-icons";
import { getYandexSiteVerificationForHost } from "@/lib/brand/yandex-site-verification";
import { CookieBanner } from "@/components/ui/CookieBanner";
import { GptStoreYandexMetrikaHead } from "@/components/analytics/GptStoreYandexMetrikaHead";
import { SubsStoreYandexMetrikaHead } from "@/components/analytics/SubsStoreYandexMetrikaHead";
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

async function resolveMetadataContext(): Promise<{ site: SiteMetaContext; host: string }> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase();
  if (host.includes("spotify-store.ru")) return { site: "subs-store", host };

  const pathname = h.get("x-invoke-pathname") ?? "";
  if (pathname.startsWith("/spotify") || pathname.startsWith("/checkout/spotify")) {
    return { site: "subs-store", host };
  }

  const search = h.get("x-invoke-search") ?? "";
  try {
    const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    if (sp.get("site") === "subs-store") return { site: "subs-store", host };
  } catch {
    /* noop */
  }

  return { site: "gpt-store", host };
}

function iconsFor(site: SiteMetaContext) {
  return buildSiteIconsMetadata(site);
}

export async function generateMetadata(): Promise<Metadata> {
  const { site, host } = await resolveMetadataContext();
  const isSpotify = site === "subs-store";

  const title = isSpotify ? "SPOTIFY STORE" : "GPT STORE";
  const description = isSpotify
    ? "Spotify Premium: подключение подписки и безопасная оплата."
    : "Подписка ChatGPT Plus/Pro в России, безопасная оплата и быстрое подключение.";
  const ogImage = isSpotify ? "/icons/spotify/og-image.png" : "/icons/gpt/og-image.png";

  const yandexVerification = getYandexSiteVerificationForHost(site, host);

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
    ...(yandexVerification ? { verification: { yandex: yandexVerification } } : {}),
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
      <head>
        <GptStoreYandexMetrikaHead />
        <SubsStoreYandexMetrikaHead />
      </head>
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
