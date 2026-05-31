import { normalizeSpotifyStoreLabel } from "@/lib/brand/spotify-store-brand";
import type { SpotifyLandingPayload } from "./spotify-landing-types";

const norm = (value: string): string => normalizeSpotifyStoreLabel(value);

/** Убирает «Subs Store» и прочие старые подписи из текстов лендинга (не трогает brand SPOTIFY/STORE). */
export function normalizeSpotifyLandingPayloadLabels(payload: SpotifyLandingPayload): SpotifyLandingPayload {
  payload.hero.badge = norm(payload.hero.badge);
  payload.hero.title = norm(payload.hero.title);
  payload.hero.accentTitle = norm(payload.hero.accentTitle);
  payload.hero.subtitle = norm(payload.hero.subtitle);
  payload.hero.trustBadges = payload.hero.trustBadges.map(norm);
  payload.hero.primaryCta = norm(payload.hero.primaryCta);
  payload.hero.secondaryCta = norm(payload.hero.secondaryCta);
  payload.hero.meta = norm(payload.hero.meta);

  payload.heroPlayerPreview.cardBadge = norm(payload.heroPlayerPreview.cardBadge);
  payload.heroPlayerPreview.cardTitle = norm(payload.heroPlayerPreview.cardTitle);
  payload.heroPlayerPreview.cardSubtitle = norm(payload.heroPlayerPreview.cardSubtitle);
  payload.heroPlayerPreview.featureChips = payload.heroPlayerPreview.featureChips.map(norm);

  payload.tickerItems = payload.tickerItems.map(norm);

  const h = payload.howItWorksSection;
  h.eyebrow = norm(h.eyebrow);
  h.title = norm(h.title);
  h.subtitle = norm(h.subtitle);
  h.steps = h.steps.map((step) => ({
    ...step,
    title: norm(step.title),
    description: norm(step.description),
  }));

  const s = payload.safetySection;
  s.eyebrow = norm(s.eyebrow);
  s.title = norm(s.title);
  s.subtitle = norm(s.subtitle);
  s.mythsTitle = norm(s.mythsTitle);
  s.myths = s.myths.map((m) => ({ myth: norm(m.myth), fact: norm(m.fact) }));
  s.principlesTitle = norm(s.principlesTitle);
  s.principles = s.principles.map((p) => ({ ...p, text: norm(p.text) }));
  s.footerNote = norm(s.footerNote);

  const r = payload.russiaSection;
  r.eyebrow = norm(r.eyebrow);
  r.title = norm(r.title);
  r.subtitle = norm(r.subtitle);
  r.points = r.points.map(norm);
  r.disclaimer = norm(r.disclaimer);

  const w = payload.whySection;
  w.eyebrow = norm(w.eyebrow);
  w.title = norm(w.title);
  w.subtitle = norm(w.subtitle);
  w.points = w.points.map(norm);
  w.footerNote = norm(w.footerNote);

  payload.reviewsSection.eyebrow = norm(payload.reviewsSection.eyebrow);
  payload.reviewsSection.title = norm(payload.reviewsSection.title);
  payload.reviewsSection.subtitle = norm(payload.reviewsSection.subtitle);

  payload.pricingSection.eyebrow = norm(payload.pricingSection.eyebrow);
  payload.pricingSection.title = norm(payload.pricingSection.title);
  payload.pricingSection.subtitle = norm(payload.pricingSection.subtitle);

  payload.projectsSection.eyebrow = norm(payload.projectsSection.eyebrow);
  payload.projectsSection.label = norm(payload.projectsSection.label);
  payload.projectsSection.title = norm(payload.projectsSection.title);
  payload.projectsSection.description = norm(payload.projectsSection.description);
  payload.projectsSection.ctaLabel = norm(payload.projectsSection.ctaLabel);

  const g = payload.guaranteeSection;
  g.eyebrow = norm(g.eyebrow);
  g.title = norm(g.title);
  g.points = g.points.map(norm);
  g.ctaLabel = norm(g.ctaLabel);
  g.supportHint = norm(g.supportHint);

  payload.faqSection.eyebrow = norm(payload.faqSection.eyebrow);
  payload.faqSection.title = norm(payload.faqSection.title);
  payload.faq = payload.faq.map((item) => ({
    question: norm(item.question),
    answer: norm(item.answer),
  }));

  const f = payload.finalCtaSection;
  f.eyebrow = norm(f.eyebrow);
  f.title = norm(f.title);
  f.subtitle = norm(f.subtitle);
  f.buttonLabel = norm(f.buttonLabel);
  f.trustLines = f.trustLines.map(norm);

  payload.nav.links = payload.nav.links.map((link) => ({
    ...link,
    label: norm(link.label),
  }));

  payload.footer.tagline = norm(payload.footer.tagline);
  payload.footer.telegramLabel = norm(payload.footer.telegramLabel);
  payload.footer.copyrightLine = norm(payload.footer.copyrightLine);
  payload.footer.crossLinkLabel = norm(payload.footer.crossLinkLabel);
  payload.footer.links = payload.footer.links.map((link) => ({
    ...link,
    label: norm(link.label),
  }));

  return payload;
}
