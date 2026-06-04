import type { Metadata } from "next";
import { AnimateSection } from "@/components/ui/AnimateSection";
import { ChatGptLandingNav } from "@/components/sections/ChatGptLandingNav";
import { ChatWidget } from "@/components/sections/ChatWidget";
import { CompareSection } from "@/components/sections/CompareSection";
import { CrossSellSection } from "@/components/sections/CrossSellSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { FinalCtaSection } from "@/components/sections/FinalCtaSection";
import { GuaranteeSection } from "@/components/sections/GuaranteeSection";
import { HeroSection } from "@/components/sections/HeroSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { PricingSection } from "@/components/sections/PricingSection";
import { ReviewsSection } from "@/components/sections/ReviewsSection";
import { SafetySection } from "@/components/sections/SafetySection";
import { StoreConfigAutoRefresh } from "@/components/sections/StoreConfigAutoRefresh";
import { Ticker } from "@/components/sections/Ticker";
import { TokenSafetySection } from "@/components/sections/TokenSafetySection";
import { LandingFooter } from "@/components/layout/LandingFooter";
import { LandingStickyMobileCta } from "@/components/landing/LandingStickyMobileCta";
import { LandingAnimatedBackground } from "@/components/ui/AnimatedBackground";
import { getLandingNavSession } from "@/lib/auth/landing-nav-session";
import { getPublicSiteOrigin } from "@/lib/app-url";
import { getStaticGptLandingPayload } from "@/lib/landing/gpt-static-landing";
import { loadGptPublishedDbReviews } from "@/lib/reviews/load-published-db-reviews";
import { sortLandingReviewsNewestFirst } from "@/lib/reviews/landing-reviews-display";

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

/** Только отзывы, одобренные в админке (вкладка «Опубликованы»). */
export default async function HomePage() {
  const [landingPayload, navSession, fromDb] = await Promise.all([
    Promise.resolve(getStaticGptLandingPayload()),
    getLandingNavSession("gpt-store"),
    loadGptPublishedDbReviews("gpt-store", 5000),
  ]);
  const { storeConfig } = landingPayload;
  const reviews = sortLandingReviewsNewestFirst(fromDb);

  const showReviews = storeConfig.landingSections.showReviews !== false;
  const showFaq = storeConfig.landingSections.showFaq !== false;
  const showCompare = storeConfig.landingSections.showCompare !== false;

  return (
    <>
      <div className="relative min-h-screen bg-white">
        <LandingAnimatedBackground />
        <ChatGptLandingNav initialLoggedIn={navSession.loggedIn} />
        <main className="relative z-[1] overflow-x-hidden pb-20 pt-0 md:pb-0">
          <div className="relative z-[1] bg-white">
            <HeroSection />
            <AnimateSection>
              <Ticker />
            </AnimateSection>
          </div>
          <AnimateSection delay={0.05}>
            <PricingSection
              initialPlans={storeConfig.plans}
              initialLandingDiscounts={storeConfig.landingDiscounts}
            />
          </AnimateSection>
          <AnimateSection delay={0.05}>
            <HowItWorksSection />
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
        <ChatWidget />
        <StoreConfigAutoRefresh />
      </div>
    </>
  );
}
