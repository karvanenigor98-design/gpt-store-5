import type { Metadata } from "next";
import { Suspense } from "react";
import { Unbounded, Golos_Text } from "next/font/google";
import { cn } from "@/lib/utils";
import { getPublicSiteOrigin } from "@/lib/app-url";
import { buildSiteIconsMetadata } from "@/lib/brand/site-icons";
import { getYandexSiteVerification } from "@/lib/brand/yandex-site-verification";
import { CookieBanner } from "@/components/ui/CookieBanner";
import { GptStoreYandexMetrikaHead } from "@/components/analytics/GptStoreYandexMetrikaHead";
import { SubsStoreYandexMetrikaHead } from "@/components/analytics/SubsStoreYandexMetrikaHead";
import { SubsStoreYandexMetrika } from "@/components/analytics/SubsStoreYandexMetrika";
import { YandexMetrika } from "@/components/analytics/YandexMetrika";
import { PromoCapture } from "@/components/checkout/PromoCapture";
import { ReferralCapture } from "@/components/referrals/ReferralCapture";
import { CSS_LOAD_GUARD_SCRIPT, CSS_LOAD_GUARD_STYLE } from "@/lib/css-load-guard";
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

const GPT_TITLE = "GPT STORE";
const GPT_DESCRIPTION =
  "Подписка ChatGPT Plus/Pro в России, безопасная оплата и быстрое подключение.";
const gptYandexVerification = getYandexSiteVerification("gpt-store");

export const metadata: Metadata = {
  title: { default: GPT_TITLE, template: `%s | ${GPT_TITLE}` },
  description: GPT_DESCRIPTION,
  metadataBase: new URL(getPublicSiteOrigin()),
  manifest: "/api/manifest?site=gpt-store",
  icons: buildSiteIconsMetadata("gpt-store"),
  applicationName: GPT_TITLE,
  openGraph: {
    title: GPT_TITLE,
    description: GPT_DESCRIPTION,
    images: [{ url: "/icons/gpt/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: GPT_TITLE,
    description: GPT_DESCRIPTION,
    images: ["/icons/gpt/og-image.png"],
  },
  other: {
    "theme-color": "#10a37f",
  },
  ...(gptYandexVerification ? { verification: { yandex: gptYandexVerification } } : {}),
};

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
        <style dangerouslySetInnerHTML={{ __html: CSS_LOAD_GUARD_STYLE }} />
        <script dangerouslySetInnerHTML={{ __html: CSS_LOAD_GUARD_SCRIPT }} />
        <GptStoreYandexMetrikaHead />
        <SubsStoreYandexMetrikaHead />
      </head>
      <body className="min-h-screen bg-white font-sans text-foreground antialiased">
        <div
          id="css-fail-banner"
          role="alert"
        >
          Стили сайта не загрузились. Нажмите Ctrl+F5 или откройте страницу в режиме инкогнито.
          <button type="button" id="css-fail-reload">
            Обновить
          </button>
        </div>
        <div className="relative" style={{ zIndex: 1 }}>
          <Suspense fallback={null}>
            <ReferralCapture />
            <PromoCapture />
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
