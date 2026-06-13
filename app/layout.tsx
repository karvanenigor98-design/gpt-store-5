import type { Metadata } from "next";
import { Suspense } from "react";
import { Unbounded, Golos_Text } from "next/font/google";
import { cn } from "@/lib/utils";
import { getMetadataBase } from "@/lib/app-url";
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

export const metadata: Metadata = {
  title: {
    default: "ChatGPT Plus без иностранной карты — GPT STORE",
    template: "%s | GPT STORE",
  },
  description:
    "Подключаем ChatGPT Plus и Pro на ваш аккаунт. Оплата картой РФ, активация за 3–15 минут, гарантия на весь срок.",
  metadataBase: getMetadataBase(),
  manifest: "/api/manifest",
  icons: {
    icon: [
      { url: "/icon-gpt.svg", type: "image/svg+xml" },
      { url: "/favicon-gpt.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon-gpt.svg", type: "image/svg+xml" }],
    shortcut: ["/favicon-gpt.svg"],
  },
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
