import type { CSSProperties } from "react";

import type { SpotifyPlan, SpotifyTabId } from "@/lib/content/spotify";

export type SpotifyPlanTier = "entry" | "popular" | "premium" | "quick" | "standard";

function planDurationMonths(plan: SpotifyPlan): number | null {
  if (plan.durationMonths != null && plan.durationMonths > 0) return plan.durationMonths;
  if (plan.id.includes("new-account")) return null;
  const slugM = plan.id.match(/-(\d+)m$/);
  if (slugM) return Number(slugM[1]);
  if (/12/.test(plan.name)) return 12;
  if (/6/.test(plan.name)) return 6;
  if (/3/.test(plan.name)) return 3;
  if (/1/.test(plan.name)) return 1;
  return null;
}

export function getSpotifyPlanTier(plan: SpotifyPlan): SpotifyPlanTier {
  if (plan.id.includes("new-account")) return "entry";

  const months = planDurationMonths(plan);
  const badge = plan.badge ?? "";

  if (months === 12 || plan.isBestValue) return "premium";
  if (months === 3 || (plan.isPopular && !plan.isBestValue)) return "popular";
  if (months === 1 || plan.name === "1 месяц" || /-1m$/.test(plan.id)) return "quick";
  if (months === 6) return "standard";

  if (/максимум|лучший/i.test(badge)) return "premium";
  if (/популярн|главн|выгодно/i.test(badge) && !/максимум|лучший/i.test(badge)) return "popular";

  return "standard";
}

export function planPeriodLabel(plan: SpotifyPlan): string {
  if (plan.id.includes("new-account")) return "разовое подключение";
  if (/12/.test(plan.name)) return "за 12 мес";
  if (/6/.test(plan.name)) return "за 6 мес";
  if (/3/.test(plan.name)) return "за 3 мес";
  if (/1/.test(plan.name)) return "за 1 мес";
  return "за период";
}

export const SPOTIFY_TAB_META: Record<
  SpotifyTabId,
  { description: string; features: string[]; compareSubtitle: string }
> = {
  individual: {
    description:
      "Один аккаунт Spotify Premium: без рекламы, офлайн и полный каталог. Выберите срок или вариант с новым аккаунтом.",
    features: ["Без рекламы", "Офлайн", "Оплата в ₽"],
    compareSubtitle: "Три формата — отличаются цена и срок подписки",
  },
  duo: {
    description:
      "Premium для двух пользователей — у каждого свой профиль. Выгоднее двух отдельных подписок.",
    features: ["2 профиля", "Без рекламы", "Поддержка при подключении"],
    compareSubtitle: "Три срока — чем дольше, тем выгоднее за месяц",
  },
  family: {
    description:
      "Семейная подписка — до 5 участников в одном тарифе. Premium для каждого профиля в семье.",
    features: ["До 5 человек", "Один платёж", "Гарантия на срок"],
    compareSubtitle: "Три срока — для семьи или нескольких близких",
  },
};

type CompareColumn = {
  tier: SpotifyPlanTier;
  badge?: string;
  eyebrow: string;
  title: string;
  body: string;
  barLabel: string;
  barPercent: number;
};

export const SPOTIFY_TAB_COMPARE: Record<SpotifyTabId, CompareColumn[]> = {
  individual: [
    {
      tier: "quick",
      eyebrow: "Быстрый старт",
      title: "1 месяц — попробовать",
      body: "Подключение на ваш аккаунт без долгой привязки. Удобно начать с Premium на месяц.",
      barLabel: "Срок: 1 месяц",
      barPercent: 28,
    },
    {
      tier: "popular",
      eyebrow: "Главный выбор",
      title: "3 месяца — баланс цены",
      body: "Чаще всего выбирают: выгоднее помесячной оплаты, тот же Premium на весь срок.",
      barLabel: "Выгода: оптимальная",
      barPercent: 72,
    },
    {
      tier: "premium",
      eyebrow: "Максимальная выгода",
      title: "12 месяцев — лучшая цена",
      body: "Максимальная экономия: не нужно продлевать каждый месяц, гарантия на весь год.",
      barLabel: "Выгода: максимальная",
      barPercent: 100,
    },
  ],
  duo: [
    {
      tier: "quick",
      eyebrow: "Быстрый старт",
      title: "1 месяц — попробовать",
      body: "Подходит, чтобы оценить формат «для двоих» без долгой привязки.",
      barLabel: "Срок: 1 месяц",
      barPercent: 30,
    },
    {
      tier: "popular",
      eyebrow: "Главный выбор",
      title: "3 месяца для двоих",
      body: "Оптимальный вариант для пары: дешевле, чем платить два раза по месяцу.",
      barLabel: "Выгода: оптимальная",
      barPercent: 70,
    },
    {
      tier: "premium",
      eyebrow: "Максимальная выгода",
      title: "12 месяцев — для двоих",
      body: "Самая низкая цена за месяц на длительный срок, гарантия на весь период.",
      barLabel: "Выгода: максимальная",
      barPercent: 100,
    },
  ],
  family: [
    {
      tier: "quick",
      eyebrow: "Быстрый старт",
      title: "1 месяц — семья",
      body: "До 5 профилей на месяц — удобно проверить, подходит ли формат всей семье.",
      barLabel: "Срок: 1 месяц",
      barPercent: 30,
    },
    {
      tier: "popular",
      eyebrow: "Главный выбор",
      title: "3 месяца — семья",
      body: "Экономия против помесячной оплаты: один платёж на всех участников.",
      barLabel: "Выгода: оптимальная",
      barPercent: 72,
    },
    {
      tier: "premium",
      eyebrow: "Максимальная выгода",
      title: "12 месяцев — семья",
      body: "Максимальная выгода для 3–5 человек: Premium на год без ежемесячных продлений.",
      barLabel: "Выгода: максимальная",
      barPercent: 100,
    },
  ],
};

export const SPOTIFY_PLAN_HOVER: Record<string, string[]> = {
  "spotify-new-account": [
    "Подходит, если не принципиален текущий аккаунт Spotify.",
    "Получаете новый аккаунт с Premium или быстрый старт «с нуля».",
    "Самая низкая цена среди индивидуальных тарифов.",
  ],
  "spotify-ind-1m": [
    "Быстрый старт: Premium на 1 месяц без долгой привязки.",
    "Подходит для пробы сервиса или краткого использования.",
    "Активация обычно 10–15 минут после оплаты.",
  ],
  "spotify-ind-3m": [
    "Оптимальный баланс цены и срока для регулярного прослушивания.",
    "Выгоднее, чем платить три раза по месяцу отдельно.",
    "Гарантия на весь оплаченный период.",
  ],
  "spotify-ind-6m": [
    "Полгода Premium без ежемесячных продлений.",
    "Хорошая цена за месяц при средней длительности.",
  ],
  "spotify-ind-12m": [
    "Максимальная экономия на год вперёд.",
    "Не нужно помнить о продлении каждый месяц.",
    "Гарантия на весь срок подписки.",
  ],
};

export function tierVisuals(tier: SpotifyPlanTier, accent: string) {
  switch (tier) {
    case "entry":
      return {
        accent: "#94a3b8",
        glow: "rgba(100, 116, 139, 0.2)",
        shell:
          "border-2 border-slate-400/55 bg-slate-500/[0.06] ring-1 ring-slate-400/25 shadow-md shadow-slate-500/10",
        chipBg: "rgba(100, 116, 139, 0.15)",
        chipBorder: "rgba(148, 163, 184, 0.45)",
      };
    case "popular":
      return {
        accent,
        glow: "rgba(29, 185, 84, 0.18)",
        shell:
          "border-2 border-[#1DB954] ring-2 ring-[#1DB954]/30 shadow-lg shadow-[#1DB954]/20 bg-[#1DB954]/[0.05]",
        chipBg: "rgba(29, 185, 84, 0.12)",
        chipBorder: "rgba(29, 185, 84, 0.35)",
      };
    case "premium":
      return {
        accent: "#f59e0b",
        glow: "rgba(245, 158, 11, 0.16)",
        shell:
          "border-2 border-amber-500 ring-2 ring-amber-400/45 shadow-lg shadow-amber-500/25 bg-amber-500/[0.05]",
        chipBg: "rgba(245, 158, 11, 0.12)",
        chipBorder: "rgba(251, 191, 36, 0.4)",
      };
    case "quick":
      return {
        accent: "#38bdf8",
        glow: "rgba(56, 189, 248, 0.14)",
        shell:
          "border-2 border-sky-400/70 bg-sky-500/[0.06] ring-1 ring-sky-400/35 shadow-md shadow-sky-500/15",
        chipBg: "rgba(56, 189, 248, 0.12)",
        chipBorder: "rgba(56, 189, 248, 0.45)",
      };
    default:
      return {
        accent: "#64748b",
        glow: "rgba(100, 116, 139, 0.12)",
        shell:
          "border-2 border-slate-500/45 bg-white/[0.03] ring-1 ring-slate-400/20 shadow-sm shadow-black/20",
        chipBg: "rgba(255,255,255,0.06)",
        chipBorder: "rgba(148, 163, 184, 0.35)",
      };
  }
}

export function compareColumnVisuals(tier: SpotifyPlanTier, accent: string) {
  const v = tierVisuals(tier, accent);
  return { ...v, isHighlight: tier === "popular" || tier === "premium" };
}

/** Тень/обводка compare-колонок = как у карточек тарифов в сетке. */
export function compareTierBoxShadow(tier: SpotifyPlanTier): CSSProperties | undefined {
  switch (tier) {
    case "popular":
      return {
        boxShadow:
          "0 0 0 2px rgba(29,185,84,0.55), 0 0 28px -4px rgba(29,185,84,0.35), 0 18px 52px -14px rgba(29, 185, 84, 0.22)",
      };
    case "premium":
      return {
        boxShadow:
          "0 0 0 2px rgba(245, 158, 11, 0.45), 0 0 24px -6px rgba(245, 158, 11, 0.28), 0 12px 38px -12px rgba(245, 158, 11, 0.2)",
      };
    case "quick":
      return {
        boxShadow:
          "0 0 0 2px rgba(56,189,248,0.5), 0 0 24px -6px rgba(56,189,248,0.22), 0 12px 36px -14px rgba(56, 189, 248, 0.18)",
      };
    default:
      return undefined;
  }
}
