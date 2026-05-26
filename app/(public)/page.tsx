import type { Metadata } from "next";
import { AnimateSection } from "@/components/ui/AnimateSection";
import { ChatGptLandingNav } from "@/components/sections/ChatGptLandingNav";
import { ChatWidget } from "@/components/sections/ChatWidget";
import { CompareSection } from "@/components/sections/CompareSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { FinalCtaSection } from "@/components/sections/FinalCtaSection";
import { GuaranteeSection } from "@/components/sections/GuaranteeSection";
import { HeroSection } from "@/components/sections/HeroSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { PricingSection } from "@/components/sections/PricingSection";
import { ReviewsSection } from "@/components/sections/ReviewsSection";
import { RussiaSection } from "@/components/sections/RussiaSection";
import { SafetySection } from "@/components/sections/SafetySection";
import { StoreConfigAutoRefresh } from "@/components/sections/StoreConfigAutoRefresh";
import { Ticker } from "@/components/sections/Ticker";
import { TokenSafetySection } from "@/components/sections/TokenSafetySection";
import { WhyCheaperSection } from "@/components/sections/WhyCheaperSection";
import { LandingFooter } from "@/components/layout/LandingFooter";
import { getPublicSiteOrigin } from "@/lib/app-url";
import { getStaticGptLandingPayload } from "@/lib/landing/gpt-static-landing";
import { loadGptTelegramCuratedReviewsAsync } from "@/lib/reviews/load-gpt-telegram-curated";

const APP_URL = getPublicSiteOrigin();

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

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

/** Все отзывы из Telegram-экспорта (messages.html + messages2.html), новые первыми. */
export default async function HomePage() {
  const { storeConfig } = getStaticGptLandingPayload();
  const reviews = await loadGptTelegramCuratedReviewsAsync();

  const showReviews = storeConfig.landingSections.showReviews !== false;
  const showFaq = storeConfig.landingSections.showFaq !== false;
  const showCompare = storeConfig.landingSections.showCompare !== false;

  return (
    <>
      <div className="min-h-screen bg-white">
        <ChatGptLandingNav />
        <main className="pt-0">
          <HeroSection />
          <AnimateSection>
            <Ticker />
          </AnimateSection>
          <AnimateSection delay={0.05}>
            <HowItWorksSection />
          </AnimateSection>
          <AnimateSection delay={0.05}>
            <SafetySection />
          </AnimateSection>
          <AnimateSection delay={0.05}>
            <TokenSafetySection />
          </AnimateSection>
          <AnimateSection delay={0.05}>
            <RussiaSection />
          </AnimateSection>
          <AnimateSection delay={0.05}>
            <WhyCheaperSection />
          </AnimateSection>
          {showReviews && (
            <AnimateSection delay={0.05}>
              <ReviewsSection reviews={reviews} />
            </AnimateSection>
          )}
          {showCompare && (
            <AnimateSection delay={0.05}>
              <CompareSection />
            </AnimateSection>
          )}
          <AnimateSection delay={0.05}>
            <PricingSection
              initialPlans={storeConfig.plans}
              initialLandingDiscounts={storeConfig.landingDiscounts}
            />
          </AnimateSection>
          <AnimateSection delay={0.05}>
            <GuaranteeSection />
          </AnimateSection>
          {showFaq && (
            <AnimateSection delay={0.05}>
              <FaqSection />
            </AnimateSection>
          )}
          <AnimateSection delay={0.05}>
            <FinalCtaSection />
          </AnimateSection>
        </main>
        <LandingFooter />
        <ChatWidget />
        <StoreConfigAutoRefresh />
      </div>
    </>
  );
}
