import { unstable_noStore as noStore } from "next/cache";
import { cache } from "react";

import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { getSubsStoreConfig } from "@/lib/subs-store-config";
import { getStaticSpotifyLandingPayload, minIndividualPrice } from "./spotify-landing-static-payload";
import { normalizeSpotifyLandingPayloadLabels } from "./normalize-spotify-landing-labels";

import { defaultSpotifySeoTitle, normalizeSpotifyStoreLabel } from "@/lib/brand/spotify-store-brand";
import { getSpotifyPublicReviews } from "@/lib/reviews/spotifyPublicReviews";

import type {
  SpotifyLandingOverrides,
  SpotifyLandingPageData,
  SpotifyLandingPayload,
} from "./spotify-landing-types";

function parseSettingValue(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }
  return value;
}

function pickStr(settings: Record<string, unknown>, key: string): string | undefined {
  const raw = settings[key];
  const v = parseSettingValue(raw);
  if (typeof v === "string" && v.trim()) return v.trim();
  return undefined;
}

function telegramUrlFromSupportUsername(raw: string | undefined): string {
  const u = (raw ?? "@subs_support").replace(/^@+/, "").trim() || "subs_support";
  return `https://t.me/${u}`;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function mergeLandingPayload(base: SpotifyLandingPayload, overrides: SpotifyLandingOverrides): SpotifyLandingPayload {
  const out = structuredClone(base) as SpotifyLandingPayload;
  if (!isPlainObject(overrides)) return out;

  if (isPlainObject(overrides.hero)) Object.assign(out.hero, overrides.hero);
  if (isPlainObject(overrides.heroPlayerPreview)) Object.assign(out.heroPlayerPreview, overrides.heroPlayerPreview);
  if (Array.isArray(overrides.tickerItems) && overrides.tickerItems.length)
    out.tickerItems = overrides.tickerItems.map(String);
  if (isPlainObject(overrides.howItWorksSection)) {
    const h = overrides.howItWorksSection;
    if (typeof h.eyebrow === "string") out.howItWorksSection.eyebrow = h.eyebrow;
    if (typeof h.title === "string") out.howItWorksSection.title = h.title;
    if (typeof h.subtitle === "string") out.howItWorksSection.subtitle = h.subtitle;
    if (Array.isArray(h.steps) && h.steps.length) out.howItWorksSection.steps = h.steps as typeof out.howItWorksSection.steps;
  }
  if (isPlainObject(overrides.safetySection)) {
    const s = overrides.safetySection;
    if (typeof s.eyebrow === "string") out.safetySection.eyebrow = s.eyebrow;
    if (typeof s.title === "string") out.safetySection.title = s.title;
    if (typeof s.subtitle === "string") out.safetySection.subtitle = s.subtitle;
    if (typeof s.mythsTitle === "string") out.safetySection.mythsTitle = s.mythsTitle;
    if (Array.isArray(s.myths) && s.myths.length) out.safetySection.myths = s.myths as typeof out.safetySection.myths;
    if (typeof s.principlesTitle === "string") out.safetySection.principlesTitle = s.principlesTitle;
    if (Array.isArray(s.principles) && s.principles.length)
      out.safetySection.principles = s.principles as typeof out.safetySection.principles;
    if (typeof s.footerNote === "string") out.safetySection.footerNote = s.footerNote;
  }
  if (isPlainObject(overrides.russiaSection)) {
    const r = overrides.russiaSection;
    if (typeof r.eyebrow === "string") out.russiaSection.eyebrow = r.eyebrow;
    if (typeof r.title === "string") out.russiaSection.title = r.title;
    if (typeof r.subtitle === "string") out.russiaSection.subtitle = r.subtitle;
    if (Array.isArray(r.points) && r.points.length) out.russiaSection.points = r.points.map(String);
    if (typeof r.disclaimer === "string") out.russiaSection.disclaimer = r.disclaimer;
  }
  if (isPlainObject(overrides.whySection)) {
    const w = overrides.whySection;
    if (typeof w.eyebrow === "string") out.whySection.eyebrow = w.eyebrow;
    if (typeof w.title === "string") out.whySection.title = w.title;
    if (typeof w.subtitle === "string") out.whySection.subtitle = w.subtitle;
    if (Array.isArray(w.points) && w.points.length) out.whySection.points = w.points.map(String);
    if (typeof w.footerNote === "string") out.whySection.footerNote = w.footerNote;
  }
  if (isPlainObject(overrides.reviewsSection)) Object.assign(out.reviewsSection, overrides.reviewsSection);
  if (isPlainObject(overrides.pricingSection)) Object.assign(out.pricingSection, overrides.pricingSection);
  if (isPlainObject(overrides.projectsSection)) Object.assign(out.projectsSection, overrides.projectsSection);
  if (isPlainObject(overrides.guaranteeSection)) Object.assign(out.guaranteeSection, overrides.guaranteeSection);
  if (isPlainObject(overrides.faqSection)) Object.assign(out.faqSection, overrides.faqSection);
  if (isPlainObject(overrides.finalCtaSection)) {
    const f = overrides.finalCtaSection;
    if (typeof f.eyebrow === "string") out.finalCtaSection.eyebrow = f.eyebrow;
    if (typeof f.title === "string") out.finalCtaSection.title = f.title;
    if (typeof f.subtitle === "string") out.finalCtaSection.subtitle = f.subtitle;
    if (typeof f.buttonLabel === "string") out.finalCtaSection.buttonLabel = f.buttonLabel;
    if (Array.isArray(f.trustLines) && f.trustLines.length)
      out.finalCtaSection.trustLines = f.trustLines.map(String);
  }
  if (isPlainObject(overrides.nav)) {
    if (typeof overrides.nav.brand === "string") out.nav.brand = overrides.nav.brand;
    if (typeof overrides.nav.brandAccent === "string") out.nav.brandAccent = overrides.nav.brandAccent;
    if (Array.isArray(overrides.nav.links) && overrides.nav.links.length)
      out.nav.links = overrides.nav.links as typeof out.nav.links;
  }
  if (isPlainObject(overrides.footer)) {
    const f = overrides.footer;
    if (typeof f.brand === "string") out.footer.brand = f.brand;
    if (typeof f.brandAccent === "string") out.footer.brandAccent = f.brandAccent;
    if (typeof f.tagline === "string") out.footer.tagline = f.tagline;
    if (typeof f.telegramLabel === "string") out.footer.telegramLabel = f.telegramLabel;
    if (typeof f.telegramUrl === "string") out.footer.telegramUrl = f.telegramUrl;
    if (Array.isArray(f.links) && f.links.length) out.footer.links = f.links as typeof out.footer.links;
    if (typeof f.copyrightLine === "string") out.footer.copyrightLine = f.copyrightLine;
    if (typeof f.crossLinkLabel === "string") out.footer.crossLinkLabel = f.crossLinkLabel;
    if (typeof f.crossLinkHref === "string") out.footer.crossLinkHref = f.crossLinkHref;
  }
  return out;
}

async function loadSubsSnapshot(): Promise<{
  settings: Record<string, unknown>;
  faq: { question: string; answer: string }[];
} | null> {
  const admin = createSubsStoreAdminClient();
  if (!admin) return null;

  try {
  const [settingsRes, faqRes] = await Promise.all([
    admin.from("site_settings").select("key,value"),
    admin.from("faq_items").select("question,answer,sort_order,is_active").order("sort_order", { ascending: true }),
  ]);

  const settings: Record<string, unknown> = {};
  for (const row of settingsRes.data ?? []) {
    const k = (row as { key?: string }).key;
    if (!k) continue;
    settings[k] = parseSettingValue((row as { value?: unknown }).value);
  }

  const faqRows = (faqRes.data ?? []) as { question?: string; answer?: string; is_active?: boolean }[];
  const faq = faqRows
    .filter((r) => r.is_active !== false)
    .map((r) => ({
      question: String(r.question || "").trim(),
      answer: String(r.answer || "").trim(),
    }))
    .filter((r) => r.question && r.answer);

  return { settings, faq };
  } catch {
    return null;
  }
}

function buildPageDataFromSnapshot(
  snapshot: Awaited<ReturnType<typeof loadSubsSnapshot>>,
  commerce: Awaited<ReturnType<typeof getSubsStoreConfig>>,
): SpotifyLandingPageData {
  let payload = getStaticSpotifyLandingPayload();

  const defaultKeywords = [
    "Spotify Premium Россия",
    "купить Spotify Premium",
    "Spotify Premium в рублях",
    "подписка Spotify Premium",
    "Spotify Premium без иностранной карты",
    "Spotify Premium для двоих",
    "Spotify Family",
    "семейная подписка Spotify",
    "Spotify Premium на год",
    "SPOTIFY STORE",
    "Spotify Premium без VPN",
    "подписка Spotify в России",
  ];

  let seoTitle = defaultSpotifySeoTitle();
  let seoDescription =
    "Подключение Spotify Premium в России с оплатой в рублях, поддержкой и гарантией. Индивидуальные тарифы, Premium для двоих и Семейная подписка. Активация 10–15 минут.";
  const keywords = [...defaultKeywords];

  if (snapshot) {
    const d = pickStr(snapshot.settings, "seoDescription");
    if (d) seoDescription = d;

    const support = pickStr(snapshot.settings, "supportUsername");
    if (support) {
      const url = telegramUrlFromSupportUsername(support);
      const handle = support.startsWith("@") ? support : `@${support.replace(/^@+/, "")}`;
      payload.guaranteeSection.supportHandle = handle;
      payload.guaranteeSection.supportTelegramUrl = url;
      payload.guaranteeSection.supportHint = `${handle} · Telegram 24/7`;
      payload.footer.telegramLabel = `Telegram: ${handle}`;
      payload.footer.telegramUrl = url;
    }

    if (commerce.plans.length) {
      payload.plans = commerce.plans;
      payload.heroPlayerPreview.priceRub = minIndividualPrice(commerce.plans);
    }

    if (snapshot.faq.length) {
      payload.faq = snapshot.faq.map((item) => ({
        question: normalizeSpotifyStoreLabel(item.question),
        answer: normalizeSpotifyStoreLabel(item.answer),
      }));
    }

    const rawOverrides = snapshot.settings["spotify_landing_overrides"];
    if (isPlainObject(rawOverrides)) {
      payload = mergeLandingPayload(payload, rawOverrides as SpotifyLandingOverrides);
    }
  }

  payload.nav.brand = "SPOTIFY";
  payload.nav.brandAccent = "STORE";
  payload.footer.brand = "SPOTIFY";
  payload.footer.brandAccent = "STORE";

  normalizeSpotifyLandingPayloadLabels(payload);

  seoTitle = defaultSpotifySeoTitle();
  seoDescription = normalizeSpotifyStoreLabel(seoDescription);

  return {
    payload,
    seo: { title: seoTitle, description: seoDescription, keywords },
  };
}

/**
 * Кэшированные данные лендинга /spotify: тарифы/FAQ/отзывы из Subs при наличии env,
 * плюс `site_settings.spotify_landing_overrides` и seoTitle/seoDescription/supportUsername.
 */
export const getSpotifyLandingPageData = cache(async (): Promise<SpotifyLandingPageData> => {
  noStore();
  try {
    const [snapshot, commerce, reviews] = await Promise.all([
      loadSubsSnapshot(),
      getSubsStoreConfig(),
      getSpotifyPublicReviews(200),
    ]);
    const data = buildPageDataFromSnapshot(snapshot, commerce);
    if (reviews.length) data.payload.reviews = reviews;
    return data;
  } catch {
    const commerce = await getSubsStoreConfig();
    const data = buildPageDataFromSnapshot(null, commerce);
    try {
      const reviews = await getSpotifyPublicReviews(200);
      if (reviews.length) data.payload.reviews = reviews;
    } catch {
      /* fallback static reviews in payload */
    }
    return data;
  }
});

export function buildSpotifyJsonLd(
  payload: SpotifyLandingPayload,
  spotifyPageUrl: string,
): Record<string, unknown>[] {
  const supportUrl = payload.guaranteeSection.supportTelegramUrl;
  const orgDesc =
    payload.hero.subtitle.length > 240 ? `${payload.hero.subtitle.slice(0, 237)}…` : payload.hero.subtitle;
  const faqEntities = payload.faq.slice(0, 20).map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  }));

  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: `${payload.nav.brand} ${payload.nav.brandAccent}`.trim(),
      url: spotifyPageUrl,
      description: orgDesc,
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        availableLanguage: "Russian",
        url: supportUrl,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: `${payload.nav.brand} ${payload.nav.brandAccent}`.trim(),
      url: spotifyPageUrl,
      inLanguage: "ru",
      description: orgDesc,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqEntities,
    },
  ];
}
