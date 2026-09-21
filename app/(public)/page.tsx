import type { Metadata } from "next";

import { LazyChatWidget } from "@/components/chat/LazyChatWidget";
import { GptSimpleFaqReviews } from "@/components/gpt-simple/GptSimpleFaqReviews";
import { GptSimpleFooter } from "@/components/gpt-simple/GptSimpleFooter";
import { GptSimpleHero } from "@/components/gpt-simple/GptSimpleHero";
import { GptSimpleHowItWorks } from "@/components/gpt-simple/GptSimpleHowItWorks";
import { GptSimpleNav } from "@/components/gpt-simple/GptSimpleNav";
import { GptSimplePlans } from "@/components/gpt-simple/GptSimplePlans";
import { GptSimpleStickyCta } from "@/components/gpt-simple/GptSimpleStickyCta";
import { StoreConfigAutoRefresh } from "@/components/sections/StoreConfigAutoRefresh";
import { getPublicSiteOrigin } from "@/lib/app-url";
import { getStaticGptLandingPayload, getStaticGptLandingReviews } from "@/lib/landing/gpt-static-landing";

const APP_URL = getPublicSiteOrigin();

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "ChatGPT Plus без иностранной карты",
  description:
    "Подключаем ChatGPT Plus и Pro на ваш аккаунт. Оплата картой РФ или СБП — без иностранной карты и VPN.",
  openGraph: {
    title: "ChatGPT Plus без иностранной карты | GPT STORE",
    description:
      "Подключаем ChatGPT Plus и Pro на ваш аккаунт. Оплата картой РФ или СБП — без иностранной карты и VPN.",
    url: APP_URL,
    type: "website",
  },
};

export default function HomePage() {
  const { storeConfig } = getStaticGptLandingPayload();
  const reviews = getStaticGptLandingReviews(12);

  return (
    <div className="relative min-h-screen bg-[#e9f8f2]">
      <GptSimpleNav />
      <main className="relative z-[1] overflow-x-hidden pb-20 pt-14 md:pb-8">
        <GptSimpleHero />
        <GptSimplePlans initialPlans={storeConfig.plans} skipAuthGate />
        <GptSimpleHowItWorks />
        <GptSimpleFaqReviews reviews={reviews} />
      </main>
      <GptSimpleFooter />
      <GptSimpleStickyCta />
      <LazyChatWidget />
      <StoreConfigAutoRefresh />
    </div>
  );
}
