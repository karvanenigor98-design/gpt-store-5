import type { SpotifyPlan } from "@/lib/content/spotify";
import { getGptStoreLandingPath } from "@/lib/store-urls";
import {
  SPOTIFY_FAQ,
  SPOTIFY_GUARANTEE_POINTS,
  SPOTIFY_HERO,
  SPOTIFY_HOW_IT_WORKS,
  SPOTIFY_PLANS,
  SPOTIFY_REVIEWS,
  SPOTIFY_RUSSIA_DISCLAIMER,
  SPOTIFY_RUSSIA_POINTS,
  SPOTIFY_SAFETY_MYTHS,
  SPOTIFY_SAFETY_PRINCIPLES,
  SPOTIFY_TICKER_ITEMS,
  SPOTIFY_WHY_POINTS,
} from "@/lib/content/spotify";

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
      eyebrow: "Как всё устроено",
      title: "Как это работает",
      subtitle: "Всё занимает 10–15 минут. Вы ничего не настраиваете самостоятельно.",
      steps,
    },
    safetySection: {
      eyebrow: "Безопасность",
      title: "Честно про подключение и данные",
      subtitle:
        "Честно и без лишнего: чаще всего пароль не нужен. Если для активации потребуется код, email или пароль — специалист заранее объяснит и примет данные только в чате. Оплата через подключённую платёжную систему.",
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
      title: "Что говорят пользователи",
      subtitle: "Публикуем реальные отзывы из Telegram и профилей клиентов на сайте.",
    },
    reviews: SPOTIFY_REVIEWS.map((r) => ({ ...r })),
    pricingSection: {
      eyebrow: "Тарифы",
      title: "Выберите подписку",
      subtitle:
        "Индивидуальная, для двоих или семейная — отличаются срок и цена. Оплата в рублях, активация 10–15 минут.",
    },
    plans: SPOTIFY_PLANS.map((p) => ({ ...p })),
    projectsSection: {
      eyebrow: "Наши проекты",
      label: "Также от SPOTIFY STORE",
      title: "GPT STORE",
      description: "Подписки ChatGPT Plus и Pro с оплатой в рублях, поддержкой и активацией на аккаунт.",
      ctaHref: getGptStoreLandingPath(),
      ctaLabel: "Перейти в GPT STORE",
      showOnLanding: true,
    },
    guaranteeSection: {
      eyebrow: "Гарантия",
      title: "Гарантия на весь срок подписки",
      points: [...SPOTIFY_GUARANTEE_POINTS],
      ctaLabel: "Написать в поддержку",
      supportHandle,
      supportTelegramUrl,
      supportHint: `${supportHandle} · Telegram 24/7`,
    },
    faqSection: { eyebrow: "Частые вопросы", title: "FAQ" },
    faq: SPOTIFY_FAQ.map((x) => ({ ...x })),
    finalCtaSection: {
      eyebrow: "Готовы начать?",
      title: "Готовы подключить Spotify Premium?",
      subtitle: "Выберите тариф, оплатите в рублях и получите Premium-доступ в среднем за 10–15 минут.",
      buttonLabel: "Выбрать тариф",
      trustLines: ["Без иностранной карты", "Активация 10–15 минут", "Гарантия на срок"],
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
