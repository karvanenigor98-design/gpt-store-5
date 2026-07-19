import type { SpotifyPlan } from "@/lib/content/spotify";
import { getCrossStoreLandingHref } from "@/lib/store-urls";
import {
  SPOTIFY_FAQ,
  SPOTIFY_GUARANTEE_POINTS,
  SPOTIFY_HERO,
  SPOTIFY_HOW_IT_WORKS,
  SPOTIFY_PLANS,
  SPOTIFY_RUSSIA_DISCLAIMER,
  SPOTIFY_RUSSIA_POINTS,
  SPOTIFY_SAFETY_MYTHS,
  SPOTIFY_SAFETY_PRINCIPLES,
  SPOTIFY_TICKER_ITEMS,
  SPOTIFY_WHY_POINTS,
} from "@/lib/content/spotify";

import { applyHeroPromoDisplayToSpotifyPlans } from "@/lib/landing/hero-promo-landing-discount";
import type { SpotifyLandingPayload } from "./spotify-landing-types";

const HOW_ICON_KEYS = ["music", "credit_card", "shield", "headphones"] as const;
const PRINCIPLE_ICON_KEYS = ["shield", "credit_card", "clock3", "headphones", "star"] as const;

function telegramUrlFromSupportUsername(raw: string | undefined): string {
  const u = (raw ?? "@subs_support").replace(/^@+/, "").trim() || "subs_support";
  return `https://t.me/${u}`;
}

export function minIndividualPrice(plans: SpotifyPlan[]): number {
  const ind = plans.filter((p) => p.tab === "individual").map((p) => p.price);
  if (!ind.length) return 490;
  return Math.min(...ind);
}

/** Статический лендинг без Subs (для fallback и default React Context). */
export function getStaticSpotifyLandingPayload(): SpotifyLandingPayload {
  const steps = SPOTIFY_HOW_IT_WORKS.map((step, i) => ({
    iconKey: HOW_ICON_KEYS[i] ?? "music",
    title: step.title,
    description: step.description,
  }));
  const principles = SPOTIFY_SAFETY_PRINCIPLES.map((p, i) => ({
    iconKey: PRINCIPLE_ICON_KEYS[i] ?? "shield",
    text: p.text,
  }));
  const supportHandle = "@subs_support";
  const supportTelegramUrl = telegramUrlFromSupportUsername(supportHandle);

  return {
    hero: { ...SPOTIFY_HERO },
    heroPlayerPreview: {
      cardBadge: "SPOTIFY STORE",
      cardTitle: "Spotify Premium",
      cardSubtitle: "Активация 10–15 минут",
      fromLabel: "От",
      priceRub: minIndividualPrice(SPOTIFY_PLANS),
      featureChips: ["Без рекламы", "Офлайн", "Поддержка"],
    },
    tickerItems: [...SPOTIFY_TICKER_ITEMS],
    howItWorksSection: {
      eyebrow: "Процесс подключения",
      title: "Оплата в рублях, подключение 10–15 минут, поддержка на связи",
      subtitle: "Вы выбираете тариф — мы сопровождаем активацию до готового Premium.",
      steps,
    },
    safetySection: {
      eyebrow: "Данные аккаунта",
      title: "Если для тарифа нужны данные — оператор подскажет безопасный способ передачи",
      subtitle:
        "Для некоторых тарифов при подключении могут понадобиться данные Spotify-аккаунта — только для активации. Оператор объяснит, что именно потребуется, и примет данные только в чате сайта.",
      mythsTitle: "Мифы и реальность",
      myths: SPOTIFY_SAFETY_MYTHS.map((m) => ({ myth: m.myth, fact: m.fact })),
      principlesTitle: "Принцип работы",
      principles,
      footerNote:
        "Пароль не просим «на всякий случай». Если он нужен для активации — вы узнаете об этом заранее в чате и передаёте только сюда.",
    },
    russiaSection: {
      eyebrow: "География",
      title: "Работает в России",
      subtitle: "Подписка активируется на аккаунт напрямую. Оплата и поддержка — на русском языке.",
      points: [...SPOTIFY_RUSSIA_POINTS],
      disclaimer: SPOTIFY_RUSSIA_DISCLAIMER,
    },
    whySection: {
      eyebrow: "Честно о цене",
      title: "Почему это выгодно?",
      subtitle: "Честный ответ — без уловок и скрытых условий.",
      points: [...SPOTIFY_WHY_POINTS],
      footerNote: "Полноценная подписка · Те же возможности · Оплата в рублях",
    },
    reviewsSection: {
      eyebrow: "Отзывы клиентов",
      title: "Что говорят пользователи после подключения Spotify Premium",
      subtitle: "Реальные отзывы из Telegram и профилей клиентов — сначала самые новые, рейтинг 4.9/5.",
    },
    // Filled on /spotify via getSpotifyPublicReviews (same source as /spotify/reviews).
    reviews: [],
    pricingSection: {
      eyebrow: "Тарифы",
      title: "Выберите Premium под себя: индивидуальный, для двоих или Family",
      subtitle:
        "1 месяц — попробовать, 3 месяца — оптимальный выбор, 12 месяцев — максимум выгоды. Оплата в рублях.",
    },
    plans: applyHeroPromoDisplayToSpotifyPlans(SPOTIFY_PLANS.map((p) => ({ ...p }))),
    projectsSection: {
      eyebrow: "Наши проекты",
      label: "Также подключаем",
      title: "ChatGPT Plus / Pro",
      description:
        "ChatGPT Plus без иностранной карты: подключение в России, оплата в рублях и поддержка.",
      ctaHref: getCrossStoreLandingHref("gpt-store"),
      ctaLabel: "Перейти в GPT STORE",
      showOnLanding: true,
    },
    guaranteeSection: {
      eyebrow: "Доверие",
      title: "Более 10 000 подключений, гарантия на срок подписки",
      points: [...SPOTIFY_GUARANTEE_POINTS],
      ctaLabel: "Написать в поддержку",
      supportHandle,
      supportTelegramUrl,
      supportHint: `${supportHandle} · Telegram 24/7`,
    },
    faqSection: {
      eyebrow: "Частые вопросы",
      title: "Ответы на вопросы про Spotify Premium, аккаунт и гарантию",
    },
    faq: SPOTIFY_FAQ.map((x) => ({ ...x })),
    finalCtaSection: {
      eyebrow: "Готовы начать?",
      title: "Подключите Spotify Premium и слушайте музыку без рекламы уже сегодня",
      subtitle: "Выберите тариф, оплатите в рублях — Premium без рекламы и с офлайном за 10–15 минут.",
      buttonLabel: "Подключить Premium",
      trustLines: ["Без рекламы и офлайн", "Активация 10–15 минут", "Гарантия на срок"],
    },
    nav: {
      brand: "SPOTIFY",
      brandAccent: "STORE",
      links: [
        { href: "#how-it-works", label: "Как работает" },
        { href: "#pricing", label: "Тарифы" },
        { href: "#reviews", label: "Отзывы" },
        { href: "#faq", label: "FAQ" },
        { href: "/dashboard/chat?site=subs-store", label: "Поддержка" },
      ],
    },
    footer: {
      brand: "SPOTIFY",
      brandAccent: "STORE",
      tagline: "Spotify Premium в России с оплатой в рублях, поддержкой и гарантией на весь срок.",
      telegramLabel: "Telegram: @subs_support",
      telegramUrl: supportTelegramUrl,
      links: [
        { href: "#how-it-works", label: "Как работает" },
        { href: "#pricing", label: "Тарифы" },
        { href: "#reviews", label: "Отзывы" },
        { href: "#faq", label: "FAQ" },
        { href: "/dashboard/chat?site=subs-store", label: "Поддержка" },
        { href: "/spotify/privacy", label: "Конфиденциальность" },
        { href: "/spotify/terms", label: "Условия" },
      ],
      copyrightLine: "SPOTIFY STORE · Spotify Premium в России",
      crossLinkLabel: "",
      crossLinkHref: "",
    },
  };
}
