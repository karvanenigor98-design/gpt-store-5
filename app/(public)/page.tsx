import type { Metadata } from "next";
import { AnimateSection } from "@/components/ui/AnimateSection";
import { LazyChatWidget } from "@/components/chat/LazyChatWidget";
import { CompareSection } from "@/components/sections/CompareSection";
import { CrossSellSection } from "@/components/sections/CrossSellSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { FinalCtaSection } from "@/components/sections/FinalCtaSection";
import { GuaranteeSection } from "@/components/sections/GuaranteeSection";
import { GptPlusValueSection } from "@/components/sections/GptPlusValueSection";
import { GptSelfPayCompareSection } from "@/components/sections/GptSelfPayCompareSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { PricingSection } from "@/components/sections/PricingSection";
import { ReviewsSection } from "@/components/sections/ReviewsSection";
import { SafetySection } from "@/components/sections/SafetySection";
import { WhyGptStoreSection } from "@/components/sections/WhyGptStoreSection";
import { StoreConfigAutoRefresh } from "@/components/sections/StoreConfigAutoRefresh";
import { Ticker } from "@/components/sections/Ticker";
import { TokenSafetySection } from "@/components/sections/TokenSafetySection";
import { LandingFooter } from "@/components/layout/LandingFooter";
import { LandingStickyMobileCta } from "@/components/landing/LandingStickyMobileCta";
import { LandingAnimatedBackground } from "@/components/ui/AnimatedBackground";
import { GptSimpleHero } from "@/components/gpt-simple/GptSimpleHero";
import { GptSimpleNav } from "@/components/gpt-simple/GptSimpleNav";
import { getStaticGptLandingPayload, getStaticGptLandingReviews } from "@/lib/landing/gpt-static-landing";
import { getPublicSiteOrigin } from "@/lib/app-url";

const APP_URL = getPublicSiteOrigin();

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "ChatGPT Plus без иностранной карты",
  description:
    "Подключаем ChatGPT Plus и Pro на ваш аккаунт. Оплата картой РФ, активация за 5–15 минут, гарантия на весь срок.",
  openGraph: {
    title: "ChatGPT Plus без иностранной карты | GPT STORE",
    description:
      "Подключаем ChatGPT Plus и Pro на ваш аккаунт. Оплата картой РФ, активация за 5–15 минут, гарантия на весь срок.",
    url: APP_URL,
    type: "website",
  },
};

export default function HomePage() {
  const { storeConfig } = getStaticGptLandingPayload();
  const reviews = getStaticGptLandingReviews(12);

  const showReviews = storeConfig.landingSections.showReviews !== false;
  const showFaq = storeConfig.landingSections.showFaq !== false;
  const showCompare = storeConfig.landingSections.showCompare !== false;

  return (
    <div className="relative min-h-screen bg-white">
      <LandingAnimatedBackground />
      <GptSimpleNav />
      <main className="relative z-[1] overflow-x-hidden pb-20 pt-16 md:pb-0">
        <div className="relative z-[1] bg-[#f6fbf9]">
          <GptSimpleHero />
          <Ticker />
        </div>
        <AnimateSection delay={0.05}>
          <HowItWorksSection />
        </AnimateSection>
        <AnimateSection delay={0.05}>
          <WhyGptStoreSection />
        </AnimateSection>
        <AnimateSection delay={0.05}>
          <GptSelfPayCompareSection />
        </AnimateSection>
        <AnimateSection delay={0.05}>
          <GptPlusValueSection />
        </AnimateSection>
        <AnimateSection delay={0.05}>
          <PricingSection
            initialPlans={storeConfig.plans}
            initialLandingDiscounts={storeConfig.landingDiscounts}
          />
        </AnimateSection>
        {showCompare && (
          <AnimateSection delay={0.05}>
            <CompareSection />
          </AnimateSection>
        )}
        <AnimateSection delay={0.05}>
          <SafetySection />
        </AnimateSection>
        <AnimateSection delay={0.05}>
          <TokenSafetySection />
        </AnimateSection>
        <AnimateSection delay={0.05}>
          <GuaranteeSection />
        </AnimateSection>
        {showReviews && (
          <AnimateSection delay={0.05}>
            <ReviewsSection reviews={reviews} />
          </AnimateSection>
        )}
        {showFaq && (
          <AnimateSection delay={0.05}>
            <FaqSection />
          </AnimateSection>
        )}
        <AnimateSection delay={0.05}>
          <CrossSellSection />
        </AnimateSection>
        <AnimateSection delay={0.05}>
          <FinalCtaSection />
        </AnimateSection>
      </main>
      <LandingFooter />
      <LandingStickyMobileCta
        site="gpt-store"
        label="Подключить ChatGPT Plus"
        accentColor="#10a37f"
        accentHover="#0d8f68"
      />
      <LazyChatWidget />
      <StoreConfigAutoRefresh />
    </div>
  );
}
