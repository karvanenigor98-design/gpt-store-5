"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import {
  SPOTIFY_PLANS,
  SPOTIFY_TABS,
  SPOTIFY_ACCENT,
  SPOTIFY_GLOW,
  type SpotifyPlan,
  type SpotifyTabId,
} from "@/lib/content/spotify";
import {
  SPOTIFY_PLAN_HOVER,
  SPOTIFY_TAB_COMPARE,
  SPOTIFY_TAB_META,
  compareColumnVisuals,
  compareTierBoxShadow,
  getSpotifyPlanTier,
  planPeriodLabel,
  tierVisuals,
  type SpotifyPlanTier,
} from "@/lib/content/spotify-pricing-ui";
import {
  computeMonthlyPrice,
  computeSavingsText,
  getFeaturedPlansForTab,
  parseSavingsDisplay,
  planCardAccent,
  resolvePlanDiscountBadge,
  sortPlansForDisplay,
} from "@/lib/spotify-plan-helpers";
import { useSpotifyLanding } from "@/components/spotify/SpotifyLandingProvider";

export function SpotifyPricing() {
  const { plans: initialPlans, pricingSection: sec } = useSpotifyLanding();
  const [activeTab, setActiveTab] = useState<SpotifyTabId>("individual");
  const [hoveredPlanId, setHoveredPlanId] = useState<string | null>(null);
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [runtimePlans, setRuntimePlans] = useState<SpotifyPlan[]>(
    initialPlans.length ? initialPlans : SPOTIFY_PLANS,
  );
  const lastPlansHashRef = useRef(JSON.stringify(runtimePlans));

  useEffect(() => {
    setRuntimePlans(initialPlans.length ? initialPlans : SPOTIFY_PLANS);
    lastPlansHashRef.current = JSON.stringify(initialPlans);
  }, [initialPlans]);

  useEffect(() => {
    let cancelled = false;

    async function syncPlans() {
      try {
        const res = await fetch("/api/public/subs-store-config", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { plans?: SpotifyPlan[] };
        const next = json.plans ?? [];
        if (!next.length) return;
        const hash = JSON.stringify(next);
        if (!cancelled && hash !== lastPlansHashRef.current) {
          lastPlansHashRef.current = hash;
          setRuntimePlans(next);
        }
      } catch {
        /* keep current */
      }
    }

    void syncPlans();
    const id = window.setInterval(() => void syncPlans(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setShowAllPlans(false);
  }, [activeTab]);

  const tabPlans = useMemo(
    () => sortPlansForDisplay(runtimePlans.filter((p) => p.tab === activeTab)),
    [runtimePlans, activeTab],
  );
  const featuredPlans = useMemo(() => getFeaturedPlansForTab(tabPlans), [tabPlans]);
  const displayedPlans = useMemo(() => {
    if (isMobile && !showAllPlans && featuredPlans.length >= 2) return featuredPlans;
    return tabPlans;
  }, [isMobile, showAllPlans, featuredPlans, tabPlans]);
  const hiddenCount = Math.max(0, tabPlans.length - displayedPlans.length);

  const tabMeta = SPOTIFY_TAB_META[activeTab];
  const compareCols = SPOTIFY_TAB_COMPARE[activeTab];
  const showTripleCompare = tabPlans.length >= 3;

  const gridClass =
    displayedPlans.length <= 2
      ? "mx-auto grid w-full max-w-3xl grid-cols-1 items-stretch gap-6 pt-2 md:grid-cols-2"
      : displayedPlans.length === 3
        ? "mx-auto grid w-full max-w-5xl grid-cols-1 items-stretch gap-6 pt-2 md:grid-cols-3"
        : "mx-auto grid w-full max-w-6xl grid-cols-1 items-stretch gap-6 pt-2 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section
      id="pricing"
      className="relative overflow-x-hidden px-4 py-20 pb-28 md:px-6 md:py-28 md:pb-32"
      style={{ background: "#0d0d0d" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(29,185,84,0.06) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mb-12 flex flex-col items-center gap-3 text-center"
        >
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
            style={{
              background: SPOTIFY_GLOW,
              border: "1px solid rgba(29,185,84,0.25)",
              color: SPOTIFY_ACCENT,
            }}
          >
            {sec.eyebrow}
          </span>
          <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">{sec.title}</h2>
          <p className="max-w-2xl text-lg" style={{ color: "rgba(255,255,255,0.5)" }}>
            {sec.subtitle}
          </p>
        </motion.div>

        <div className="mb-10 flex justify-center">
          <div
            className="flex w-full max-w-md gap-1 rounded-2xl p-1.5 sm:w-auto"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {SPOTIFY_TABS.map((tab) => (
              <motion.button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="relative flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors duration-200 sm:flex-none md:px-5 md:py-2.5 md:text-sm"
                style={{ color: activeTab === tab.id ? "white" : "rgba(255,255,255,0.4)" }}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="spotify-tab-bg"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: SPOTIFY_ACCENT }}
                    transition={{ type: "spring", duration: 0.4 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeTab}-desc`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className={`mx-auto w-full max-w-5xl ${showTripleCompare ? "mb-10" : "mb-12"}`}
          >
            <div className="flex flex-col items-center justify-center gap-4 text-center sm:flex-row md:gap-8">
              <p
                className="max-w-xl text-base leading-relaxed sm:text-left"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                {tabMeta.description}
              </p>
              <div className="flex shrink-0 flex-wrap justify-center gap-2 sm:justify-end">
                {tabMeta.features.map((f) => (
                  <span
                    key={f}
                    className="rounded-full border px-2.5 py-1 text-xs font-medium"
                    style={{
                      color: SPOTIFY_ACCENT,
                      background: SPOTIFY_GLOW,
                      borderColor: "rgba(29,185,84,0.3)",
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {showTripleCompare && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.35 }}
            className="mb-10"
          >
            <p
              className="mb-4 hidden text-center text-xs font-semibold uppercase tracking-[0.2em] md:block"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              {tabMeta.compareSubtitle}
            </p>
            <div className="mx-auto hidden max-w-6xl grid-cols-3 items-stretch gap-4 md:grid">
              {compareCols.map((col) => {
                const v = compareColumnVisuals(col.tier, SPOTIFY_ACCENT);
                const tierShadow = compareTierBoxShadow(col.tier);
                return (
                  <div
                    key={col.tier}
                    className={`relative flex h-full min-h-[9.5rem] flex-col overflow-hidden rounded-2xl p-4 md:min-h-[10rem] md:p-5 ${v.shell}`}
                    style={{
                      background:
                        col.tier === "premium"
                          ? "rgba(245,158,11,0.05)"
                          : col.tier === "popular"
                            ? "rgba(29,185,84,0.07)"
                            : col.tier === "quick"
                              ? "rgba(56,189,248,0.05)"
                              : undefined,
                      ...tierShadow,
                    }}
                  >
                    <span
                      className="relative inline-flex w-fit max-w-full rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
                      style={{ background: v.accent }}
                    >
                      {col.badge ?? col.eyebrow}
                    </span>
                    <p className="relative mt-3 font-heading text-base font-bold text-white md:text-lg">
                      {col.title}
                    </p>
                    <p
                      className="relative mt-2 text-xs leading-relaxed md:text-sm"
                      style={{ color: "rgba(255,255,255,0.55)" }}
                    >
                      {col.body}
                    </p>
                    <div
                      className="relative mt-3 flex h-2 overflow-hidden rounded-full"
                      style={{ background: "rgba(255,255,255,0.08)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${col.barPercent}%`,
                          background: v.accent,
                        }}
                      />
                    </div>
                    <p
                      className="relative mt-1.5 text-[10px] font-medium md:text-[11px]"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      {col.barLabel}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeTab}-plans`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
            className={`${gridClass} [&>article]:h-full`}
          >
            {displayedPlans.map((plan, index) => {
              const tier = getSpotifyPlanTier(plan);
              const compareCol = compareCols.find((c) => c.tier === tier) ?? null;
              return (
              <PlanCard
                key={plan.id}
                plan={plan}
                tabPlans={tabPlans}
                index={index}
                isHovered={hoveredPlanId === plan.id}
                isMobile={isMobile}
                mobileCompare={compareCol}
                onHoverStart={() => setHoveredPlanId(plan.id)}
                onHoverEnd={() => setHoveredPlanId((p) => (p === plan.id ? null : p))}
              />
            );
            })}
          </motion.div>
        </AnimatePresence>

        {isMobile && hiddenCount > 0 && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAllPlans((v) => !v)}
              className="flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition-colors"
              style={{
                borderColor: "rgba(29,185,84,0.35)",
                color: SPOTIFY_ACCENT,
                background: "rgba(29,185,84,0.08)",
              }}
            >
              {showAllPlans ? "Скрыть дополнительные тарифы" : `Показать все тарифы (+${hiddenCount})`}
              <ChevronDown
                size={16}
                className={`transition-transform ${showAllPlans ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        )}

        <p className="mt-10 pb-2 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
          Оплата картой РФ · СБП · Без иностранной карты
        </p>
      </div>
    </section>
  );
}

const SUBS_CTA_GREEN_STYLE: CSSProperties = {
  background: `linear-gradient(135deg, ${SPOTIFY_ACCENT} 0%, #17a349 55%, #1DB954 100%)`,
  color: "white",
  boxShadow: "0 8px 32px -4px rgba(29,185,84,0.45)",
};

/** Нижний ряд (новый аккаунт, 6 мес) — чуть холоднее/глубже, чем «Главный выбор». */
const SUBS_SECONDARY_ACCENT = "#10b981";

const SUBS_CTA_SECONDARY: CSSProperties = {
  background: "linear-gradient(135deg, #34d399 0%, #10b981 52%, #059669 100%)",
  color: "white",
  boxShadow: "0 4px 18px -6px rgba(16, 185, 129, 0.38)",
};

function planCtaUsesShimmer(tier: SpotifyPlanTier): boolean {
  return tier === "quick" || tier === "popular" || tier === "premium";
}

function getPlanCtaStyle(tier: SpotifyPlanTier): CSSProperties {
  if (tier === "premium") {
    return {
      background: "linear-gradient(135deg, #fde68a 0%, #f59e0b 45%, #d97706 100%)",
      color: "#0a0a0a",
      boxShadow: "0 6px 28px -6px rgba(245, 158, 11, 0.55)",
    };
  }
  if (tier === "popular") return SUBS_CTA_GREEN_STYLE;
  if (tier === "quick") {
    return {
      background: "linear-gradient(135deg, #7dd3fc 0%, #0284c7 55%, #0369a1 100%)",
      color: "white",
      boxShadow: "0 6px 24px -8px rgba(2, 132, 199, 0.45)",
    };
  }
  return SUBS_CTA_SECONDARY;
}

function PlanCard({
  plan,
  tabPlans,
  index,
  isHovered,
  isMobile,
  mobileCompare,
  onHoverStart,
  onHoverEnd,
}: {
  plan: SpotifyPlan;
  tabPlans: SpotifyPlan[];
  index: number;
  isHovered: boolean;
  isMobile: boolean;
  mobileCompare?: (typeof SPOTIFY_TAB_COMPARE)["individual"][number] | null;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const tier = getSpotifyPlanTier(plan);
  const accent = planCardAccent(plan);
  const v = tierVisuals(tier, SPOTIFY_ACCENT);
  const period = planPeriodLabel(plan);
  const displayPrice = plan.price;
  const strikePrice = plan.originalPrice ?? plan.oldPrice;
  const showStrike = strikePrice != null && strikePrice > displayPrice;
  const discountBadge = resolvePlanDiscountBadge(plan, displayPrice, strikePrice);
  const monthly = computeMonthlyPrice(plan);
  const savings = computeSavingsText(plan, tabPlans);
  const savingsAccent =
    tier === "premium" ? "#f59e0b"
    : tier === "entry" || tier === "standard" ? SUBS_SECONDARY_ACCENT
    : accent.color;
  const ctaText = plan.ctaText ?? `Подключить за ${displayPrice.toLocaleString("ru")} ₽`;
  const hoverDetails =
    SPOTIFY_PLAN_HOVER[plan.id] ??
    [plan.shortDescription ?? plan.description, plan.features[0] ?? "", plan.features[1] ?? ""].filter(
      Boolean,
    );
  const showDetails = isMobile ? detailsOpen : isHovered;

  const tierChip =
    tier === "entry"
      ? "Минимальный вход"
      : tier === "popular"
        ? "Главный выбор"
        : tier === "premium"
          ? "Лучший выбор"
          : tier === "quick"
            ? "Быстрый старт"
            : null;

  const articleShadow = (() => {
    if (tier === "premium") {
      return {
        boxShadow: `0 0 0 2px rgba(245, 158, 11, 0.45), 0 0 24px -6px rgba(245, 158, 11, 0.28), 0 12px 38px -12px rgba(245, 158, 11, 0.2)`,
      };
    }
    if (tier === "popular") {
      return {
        boxShadow: `0 0 0 2px rgba(29,185,84,0.55), 0 0 28px -4px rgba(29,185,84,0.35), 0 18px 52px -14px rgba(29, 185, 84, 0.22)`,
      };
    }
    if (tier === "entry") {
      return { boxShadow: "0 6px 20px -12px rgba(71, 85, 105, 0.12)" };
    }
    if (tier === "quick") {
      return {
        boxShadow: `0 0 0 2px rgba(56,189,248,0.5), 0 0 24px -6px rgba(56,189,248,0.22), 0 12px 36px -14px rgba(56, 189, 248, 0.18)`,
      };
    }
    return { boxShadow: "0 8px 24px -14px rgba(0,0,0,0.4)" };
  })();

  const cardBg =
    tier === "popular"
      ? "rgba(29,185,84,0.07)"
      : tier === "premium"
        ? "rgba(245,158,11,0.05)"
        : tier === "quick"
          ? "rgba(56,189,248,0.05)"
          : "rgba(255,255,255,0.03)";

  const visibleFeatures = plan.features.slice(0, 3);

  const mobileCompareBlock =
    isMobile && mobileCompare ? (
      (() => {
        const v = compareColumnVisuals(mobileCompare.tier, SPOTIFY_ACCENT);
        const tierShadow = compareTierBoxShadow(mobileCompare.tier);
        return (
          <div
            className={`relative mb-4 overflow-hidden rounded-2xl border-2 px-4 py-3.5 md:hidden ${v.shell}`}
            style={{
              background:
                mobileCompare.tier === "popular"
                  ? "rgba(29,185,84,0.12)"
                  : mobileCompare.tier === "premium"
                    ? "rgba(245,158,11,0.1)"
                    : mobileCompare.tier === "quick"
                      ? "rgba(56,189,248,0.1)"
                      : "rgba(255,255,255,0.05)",
              ...(tierShadow ?? { boxShadow: `0 8px 24px -8px ${v.accent}55` }),
            }}
          >
            <span
              className="mb-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
              style={{ background: v.accent }}
            >
              {mobileCompare.badge ?? mobileCompare.eyebrow}
            </span>
            <p className="text-sm font-bold text-white">{mobileCompare.title}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-white/70">{mobileCompare.body}</p>
            <div
              className="relative mt-3 flex h-2 overflow-hidden rounded-full"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${mobileCompare.barPercent}%`, background: v.accent }}
              />
            </div>
            <p className="mt-1 text-[10px] font-medium text-white/45">{mobileCompare.barLabel}</p>
          </div>
        );
      })()
    ) : null;

  return (
    <div className="flex flex-col">
      {mobileCompareBlock}
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      whileHover={isMobile ? undefined : { y: -4, transition: { duration: 0.2 } }}
      onHoverStart={isMobile ? undefined : onHoverStart}
      onHoverEnd={isMobile ? undefined : onHoverEnd}
      onFocusCapture={isMobile ? undefined : onHoverStart}
      onBlurCapture={isMobile ? undefined : onHoverEnd}
      className={`relative flex h-full min-h-[24rem] flex-col overflow-hidden rounded-2xl p-5 md:min-h-[25rem] md:p-6 ${v.shell}`}
      style={{ background: cardBg, ...articleShadow }}
    >
      {discountBadge ? (
        <span
          className="absolute right-3 top-3 z-20 max-w-[46%] text-right text-[10px] font-extrabold uppercase leading-tight tracking-wide md:right-4 md:top-4 md:text-[11px]"
          style={{
            padding: "0.4rem 0.65rem",
            borderRadius: "0.65rem",
            background: "linear-gradient(135deg, #fde047 0%, #f59e0b 55%, #ea580c 100%)",
            color: "#0a0a0a",
            border: "2px solid rgba(255,255,255,0.45)",
            boxShadow: "0 6px 20px rgba(245,158,11,0.65), 0 0 0 1px rgba(0,0,0,0.25)",
          }}
        >
          {discountBadge}
        </span>
      ) : null}

      <div className={`mb-4 shrink-0 ${discountBadge ? "pr-[5.5rem] md:pr-28" : ""}`}>
        <div className="mb-1.5 min-h-[2.75rem]">
          <p className="line-clamp-2 font-heading text-base font-bold leading-snug text-white md:text-lg">
            {plan.name}
          </p>
        </div>
        <div className="mb-2 flex h-6 items-center">
          <span
            className={`inline-flex w-fit max-w-full rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 md:text-xs ${
              tierChip ? "" : "invisible"
            }`}
            style={{ color: v.accent, background: v.chipBg, borderColor: v.chipBorder }}
          >
            {tierChip ?? "—"}
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {showStrike && (
            <span
              className="font-heading text-lg font-semibold line-through"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              {strikePrice!.toLocaleString("ru")} ₽
            </span>
          )}
          <span className="font-heading text-3xl font-bold text-white">
            {displayPrice.toLocaleString("ru")}
          </span>
          <span className="text-base md:text-lg" style={{ color: SPOTIFY_ACCENT }}>
            ₽
          </span>
        </div>
        <div className="mt-1 flex min-h-[1.35rem] flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
            {period}
          </p>
          <p
            className={`text-sm font-bold md:text-base ${monthly == null ? "invisible" : ""}`}
            style={{
              color:
                tier === "quick" ? "#38bdf8"
                : tier === "premium" ? "#f59e0b"
                : tier === "popular" ? SPOTIFY_ACCENT
                : accent.color,
            }}
          >
            {monthly != null ? `≈ ${monthly.toLocaleString("ru")} ₽/мес` : "≈ — ₽/мес"}
          </p>
        </div>
        <p className="mt-2 text-sm leading-snug" style={{ color: "rgba(255,255,255,0.5)" }}>
          {plan.shortDescription ?? plan.description}
        </p>
        {tier === "entry" && (
          <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.38)" }}>
            Подойдёт, если не нужен текущий Spotify-аккаунт · выдаём новый с Premium
          </p>
        )}
      </div>

      <ul className="mb-4 shrink-0 space-y-2">
        {visibleFeatures.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
              style={{ background: v.glow }}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
                <path
                  d="M1.5 4l2 2 3-3"
                  stroke={v.accent}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="text-sm leading-snug" style={{ color: "rgba(255,255,255,0.62)" }}>
              {f}
            </span>
          </li>
        ))}
      </ul>

      {isMobile && (
        <button
          type="button"
          onClick={() => setDetailsOpen((o) => !o)}
          className="mb-3 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-semibold"
          style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)" }}
        >
          Подробнее о подписке
          <ChevronDown size={14} className={`shrink-0 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
        </button>
      )}

      <div className="min-h-0 flex-1" aria-hidden />

      <div className="relative mt-auto flex shrink-0 flex-col gap-2.5 pt-2">
        {savings ? (() => {
          const { amount, suffix } = parseSavingsDisplay(savings);
          return (
            <div
              className="w-full rounded-xl border-2 px-2.5 py-2 text-center"
              style={{
                borderColor: `${savingsAccent}70`,
                background: `linear-gradient(160deg, ${savingsAccent}30 0%, ${savingsAccent}12 55%, rgba(0,0,0,0.2) 100%)`,
                boxShadow: `0 6px 20px -8px ${savingsAccent}50`,
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-[0.12em]"
                style={{ color: savingsAccent }}
              >
                Экономия
              </p>
              <p
                className="mt-0.5 font-heading text-base font-extrabold leading-none text-white md:text-lg"
                style={{ textShadow: `0 0 20px ${savingsAccent}66` }}
              >
                {amount}
              </p>
              {suffix && (
                <p className="mt-1 text-[11px] font-medium md:text-xs" style={{ color: "rgba(255,255,255,0.72)" }}>
                  {suffix}
                </p>
              )}
            </div>
          );
        })() : null}
        <motion.a
          href={`/checkout/spotify?plan=${plan.id}`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`relative flex h-11 w-full shrink-0 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-all ${
            planCtaUsesShimmer(tier) ? "shimmer-btn overflow-hidden" : ""
          }`}
          style={getPlanCtaStyle(tier)}
        >
          <span className={planCtaUsesShimmer(tier) ? "relative z-[2]" : ""}>{ctaText}</span>
        </motion.a>
      </div>

      <AnimatePresence initial={false}>
        {showDetails && (
          <motion.div
            key={`${plan.id}-details`}
            initial={{ height: 0, opacity: 0, y: 8 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div
              className="mt-3 rounded-xl border px-3 py-3"
              style={{ borderColor: `${v.accent}44`, background: v.glow }}
            >
              {!isMobile && (
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: v.accent }}>
                  Подробнее о подписке
                </p>
              )}
              <ul className={`space-y-1.5 ${isMobile ? "" : "mt-2"}`}>
                {hoverDetails.map((detail) => (
                  <li
                    key={detail}
                    className="text-xs leading-relaxed"
                    style={{ color: "rgba(255,255,255,0.65)" }}
                  >
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
    </div>
  );
}
