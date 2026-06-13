import type { Metadata } from "next";
import {
  defaultSpotifySeoTitle,
  SPOTIFY_STORE_LINK_NAME,
} from "@/lib/brand/spotify-store-brand";
import { SPOTIFY_LINK_PREVIEW_DESCRIPTION } from "@/lib/brand/spotify-link-preview-html";
import { getPublicSiteOrigin } from "@/lib/app-url";
import { buildSpotifyJsonLd } from "@/lib/landing/get-spotify-landing-payload";
import { getStaticSpotifyLandingPayload } from "@/lib/landing/spotify-landing-static-payload";
import { SpotifyNav } from "@/components/spotify/SpotifyNav";
import { SpotifyHero } from "@/components/spotify/SpotifyHero";
import { SpotifyTicker } from "@/components/spotify/SpotifyTicker";
import { SpotifyHowItWorks } from "@/components/spotify/SpotifyHowItWorks";
import { SpotifySafety } from "@/components/spotify/SpotifySafety";
import { SpotifyRussia } from "@/components/spotify/SpotifyRussia";
import { SpotifyWhySection } from "@/components/spotify/SpotifyWhySection";
import { SpotifyReviews } from "@/components/spotify/SpotifyReviews";
import { SpotifyCompare } from "@/components/spotify/SpotifyCompare";
import { SpotifyPricing } from "@/components/spotify/SpotifyPricing";
import { SpotifyGuarantee } from "@/components/spotify/SpotifyGuarantee";
import { SpotifyFaq } from "@/components/spotify/SpotifyFaq";
import { SpotifyFinalCta } from "@/components/spotify/SpotifyFinalCta";
import { SpotifyGptCrossSell } from "@/components/spotify/SpotifyGptCrossSell";
import { SpotifyFooter } from "@/components/spotify/SpotifyFooter";
import { SpotifyLandingProvider } from "@/components/spotify/SpotifyLandingProvider";
import { SpotifyStoreConfigAutoRefresh } from "@/components/spotify/SpotifyStoreConfigAutoRefresh";
import { AnimateSection } from "@/components/ui/AnimateSection";
import { ChatWidget } from "@/components/sections/ChatWidget";
import { LandingStickyMobileCta } from "@/components/landing/LandingStickyMobileCta";

const APP_URL = getPublicSiteOrigin();
const SPOTIFY_URL = `${APP_URL}/spotify`;
const SPOTIFY_TITLE = defaultSpotifySeoTitle();

export const metadata: Metadata = {
  title: { absolute: SPOTIFY_TITLE },
  description: SPOTIFY_LINK_PREVIEW_DESCRIPTION,
  openGraph: {
    title: SPOTIFY_TITLE,
    description: SPOTIFY_LINK_PREVIEW_DESCRIPTION,
    url: SPOTIFY_URL,
    siteName: SPOTIFY_STORE_LINK_NAME,
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SPOTIFY_TITLE,
    description: SPOTIFY_LINK_PREVIEW_DESCRIPTION,
  },
  alternates: { canonical: SPOTIFY_URL },
  robots: {
    index: true,
    follow: true,
  },
};

/** Статический shell — тарифы/сессия подтягиваются на клиенте. */
export default function SpotifyPage() {
  const payload = getStaticSpotifyLandingPayload();
  const jsonLd = buildSpotifyJsonLd(payload, SPOTIFY_URL);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        suppressHydrationWarning
      />
      <SpotifyLandingProvider payload={payload}>
        <SpotifyStoreConfigAutoRefresh />
        <div className="relative" style={{ background: "#0a0a0a", color: "#ffffff" }}>
          <SpotifyNav />
          <main className="overflow-x-hidden pb-20 pt-14 md:pb-0">
            <SpotifyHero />
            <AnimateSection>
              <SpotifyTicker />
            </AnimateSection>
            <AnimateSection delay={0.05}>
              <SpotifyPricing />
            </AnimateSection>
            <AnimateSection delay={0.05}>
              <SpotifyCompare />
            </AnimateSection>
            <AnimateSection delay={0.05}>
              <SpotifyHowItWorks />
            </AnimateSection>
            <AnimateSection delay={0.05}>
              <SpotifySafety />
            </AnimateSection>
            <AnimateSection delay={0.05}>
              <SpotifyGuarantee />
            </AnimateSection>
            <AnimateSection delay={0.05}>
              <SpotifyRussia />
            </AnimateSection>
            <AnimateSection delay={0.05}>
              <SpotifyWhySection />
            </AnimateSection>
            <AnimateSection delay={0.05}>
              <SpotifyReviews />
            </AnimateSection>
            <AnimateSection delay={0.05}>
              <SpotifyFaq />
            </AnimateSection>
            <AnimateSection delay={0.05}>
              <SpotifyGptCrossSell />
            </AnimateSection>
            <AnimateSection delay={0.05}>
              <SpotifyFinalCta />
            </AnimateSection>
          </main>
          <SpotifyFooter />
          <LandingStickyMobileCta
            site="subs-store"
            label={payload.hero.primaryCta}
            accentColor="#1DB954"
            accentHover="#17a349"
            variant="dark"
          />
          <ChatWidget siteSlug="subs-store" />
        </div>
      </SpotifyLandingProvider>
    </>
  );
}
