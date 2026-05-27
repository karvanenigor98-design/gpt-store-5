import type { SpotifyPlan } from "@/lib/content/spotify";

/** Сериализуемый отзыв для карточки на /spotify (как в SPOTIFY_REVIEWS). */
export type SpotifyLandingReview = {
  id: string;
  authorName: string;
  authorUsername?: string | null;
  initials: string;
  avatarColor: string;
  tariff: string;
  dateLabel: string;
  rating: number;
  content: string;
  sourceUrl?: string | null;
  inSiteProfileUrl?: string;
  /** ISO или ms — сортировка «сначала новые» (не показывается в UI). */
  sortTs?: string | number | null;
};

export type SpotifyLandingFaqItem = { question: string; answer: string };

export type SpotifyHeroPayload = {
  badge: string;
  title: string;
  accentTitle: string;
  subtitle: string;
  trustBadges: string[];
  primaryCta: string;
  secondaryCta: string;
  meta: string;
};

export type SpotifyHeroPlayerPreview = {
  cardBadge: string;
  cardTitle: string;
  cardSubtitle: string;
  fromLabel: string;
  priceRub: number;
  featureChips: string[];
};

export type SpotifyHowStepPayload = { iconKey: string; title: string; description: string };

export type SpotifySafetyMythPayload = { myth: string; fact: string };

export type SpotifySafetyPrinciplePayload = { iconKey: string; text: string };

/** Полный набор текстов/данных для публичного лендинга /spotify (дефолт + Subs + overrides). */
export type SpotifyLandingPayload = {
  hero: SpotifyHeroPayload;
  heroPlayerPreview: SpotifyHeroPlayerPreview;
  tickerItems: string[];
  howItWorksSection: {
    eyebrow: string;
    title: string;
    subtitle: string;
    steps: SpotifyHowStepPayload[];
  };
  safetySection: {
    eyebrow: string;
    title: string;
    subtitle: string;
    mythsTitle: string;
    myths: SpotifySafetyMythPayload[];
    principlesTitle: string;
    principles: SpotifySafetyPrinciplePayload[];
    footerNote: string;
  };
  russiaSection: {
    eyebrow: string;
    title: string;
    subtitle: string;
    points: string[];
    disclaimer: string;
  };
  whySection: {
    eyebrow: string;
    title: string;
    subtitle: string;
    points: string[];
    footerNote: string;
  };
  reviewsSection: { eyebrow: string; title: string; subtitle: string };
  reviews: SpotifyLandingReview[];
  pricingSection: { eyebrow: string; title: string; subtitle: string };
  plans: SpotifyPlan[];
  projectsSection: {
    eyebrow: string;
    label: string;
    title: string;
    description: string;
    ctaHref: string;
    ctaLabel: string;
    /** false — блок «GPT STORE» не показываем на лендинге Subs */
    showOnLanding?: boolean;
  };
  guaranteeSection: {
    eyebrow: string;
    title: string;
    points: string[];
    ctaLabel: string;
    supportHandle: string;
    supportTelegramUrl: string;
    supportHint: string;
  };
  faqSection: { eyebrow: string; title: string };
  faq: SpotifyLandingFaqItem[];
  finalCtaSection: {
    eyebrow: string;
    title: string;
    subtitle: string;
    buttonLabel: string;
    trustLines: string[];
  };
  nav: {
    brand: string;
    brandAccent: string;
    links: { href: string; label: string }[];
  };
  footer: {
    brand: string;
    brandAccent: string;
    tagline: string;
    telegramLabel: string;
    telegramUrl: string;
    links: { href: string; label: string }[];
    copyrightLine: string;
    crossLinkLabel: string;
    crossLinkHref: string;
  };
};

export type SpotifyLandingPageData = {
  payload: SpotifyLandingPayload;
  seo: { title: string; description: string; keywords: string[] };
};

/** Частичные оверрайды из site_settings.key = spotify_landing_overrides (JSON). */
export type SpotifyLandingOverrides = Partial<{
  hero: Partial<SpotifyHeroPayload>;
  heroPlayerPreview: Partial<SpotifyHeroPlayerPreview>;
  tickerItems: string[];
  howItWorksSection: Partial<{
    eyebrow: string;
    title: string;
    subtitle: string;
    steps: SpotifyHowStepPayload[];
  }>;
  safetySection: Partial<{
    eyebrow: string;
    title: string;
    subtitle: string;
    mythsTitle: string;
    myths: SpotifySafetyMythPayload[];
    principlesTitle: string;
    principles: SpotifySafetyPrinciplePayload[];
    footerNote: string;
  }>;
  russiaSection: Partial<{
    eyebrow: string;
    title: string;
    subtitle: string;
    points: string[];
    disclaimer: string;
  }>;
  whySection: Partial<{
    eyebrow: string;
    title: string;
    subtitle: string;
    points: string[];
    footerNote: string;
  }>;
  reviewsSection: Partial<{ eyebrow: string; title: string; subtitle: string }>;
  pricingSection: Partial<{ eyebrow: string; title: string; subtitle: string }>;
  projectsSection: Partial<SpotifyLandingPayload["projectsSection"]>;
  guaranteeSection: Partial<SpotifyLandingPayload["guaranteeSection"]>;
  faqSection: Partial<{ eyebrow: string; title: string }>;
  finalCtaSection: Partial<SpotifyLandingPayload["finalCtaSection"]>;
  nav: Partial<SpotifyLandingPayload["nav"]>;
  footer: Partial<SpotifyLandingPayload["footer"]>;
}>;
