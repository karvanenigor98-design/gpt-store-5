"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PLUS_PLANS, PRO_PLANS, PRODUCTS, PLUS_READY_CHECKOUT_WARNING, type ProductId } from "@/lib/chatgpt-data";
import { fadeUp } from "@/lib/motion-config";
import {
  GPT_TARIFF_GUIDE_ITEMS,
  TariffChooseGuide,
} from "@/components/landing/TariffChooseGuide";
import { ConnectCheckoutButton } from "@/components/checkout/ConnectCheckoutButton";

type RuntimePlan = (typeof PLUS_PLANS)[number] & {
  original_price?: number;
  landing_discount_name?: string | null;
};

const PLUS_MOBILE_COMPARE: Record<string, { text: string; shell: string }> = {
  "plus-ready": {
    text: "Готовый аккаунт: Plus уже активирован, данные для входа после оплаты.",
    shell:
      "border-sky-400/75 bg-gradient-to-br from-sky-50 via-white to-white text-sky-950 shadow-sky-500/12 ring-sky-200/50",
  },
  "plus-std": {
    text: "Популярный: лучший баланс цены и скорости.",
    shell:
      "border-[#10a37f]/50 bg-gradient-to-br from-emerald-50/95 via-white to-white text-gray-800 shadow-emerald-600/15 ring-emerald-200/60",
  },
  "plus-fast": {
    text: "Быстрая активация: приоритетное подключение.",
    shell:
      "border-amber-400/80 bg-gradient-to-br from-amber-50 via-white to-orange-50/40 text-amber-950 shadow-amber-500/15 ring-amber-300/50",
  },
};

const PRO_MOBILE_COMPARE: Record<string, { text: string; shell: string }> = {
  "pro-5x": {
    text: "Pro 5x: для активной ежедневной работы.",
    shell:
      "border-sky-400/75 bg-gradient-to-br from-sky-50 via-white to-white text-sky-950 shadow-sky-500/12 ring-sky-200/50",
  },
  "pro-20x": {
    text: "Pro 20x: для высокой нагрузки и бизнеса.",
    shell:
      "border-emerald-500/75 bg-gradient-to-br from-emerald-50 via-white to-amber-50/30 text-emerald-950 shadow-emerald-600/12 ring-emerald-300/40",
  },
};

function MobileTariffCompareHint({ text, shell }: { text: string; shell: string }) {
  return (
    <div
      className={`relative mb-4 overflow-hidden rounded-2xl border-2 px-4 py-3.5 text-sm font-semibold leading-snug shadow-md ring-1 ring-black/[0.04] md:hidden ${shell}`}
    >
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] opacity-75">
        Сравнение тарифов
      </span>
      {text}
    </div>
  );
}

const PLAN_HOVER_DETAILS: Record<string, string[]> = {
  "plus-ready": [
    "Готовый аккаунт ChatGPT Plus с уже активированной подпиской.",
    "После оплаты оператор передаст данные для входа.",
    "Не подходит для подключения Plus на ваш текущий аккаунт.",
  ],
  "plus-std": [
    "Универсальный тариф для ежедневной работы без переплаты.",
    "Подходит, если нужен стабильный Plus на обычных условиях.",
    "Оптимальный баланс цены и скорости подключения.",
  ],
  "plus-fast": [
    "Приоритетная активация: обычно 5-15 минут после передачи данных.",
    "Для тех, кому важно подключиться как можно быстрее.",
    "Те же функции Plus, но с ускоренной очередью.",
  ],
  "pro-5x": [
    "Одинаковые функции с Pro 20x, отличие только в объеме лимитов.",
    "Около 5x лимитов относительно Plus для активной ежедневной работы.",
    "Лучше всего подходит для кода, текстов и задач средней нагрузки.",
  ],
  "pro-20x": [
    "Одинаковые функции с Pro 5x, но максимальный объем использования.",
    "Около 20x лимитов относительно Plus для интенсивной нагрузки.",
    "Выбор для бизнеса, автоматизаций и работы с несколькими проектами.",
  ],
};

export function PricingSection({
  initialPlans,
}: {
  initialPlans?: RuntimePlan[];
  initialLandingDiscounts?: unknown[];
}) {
  const [activeProduct, setActiveProduct] = useState<ProductId>("chatgpt-plus");
  const [hoveredPlanId, setHoveredPlanId] = useState<string | null>(null);
  const [runtimePlans, setRuntimePlans] = useState<RuntimePlan[]>(
    initialPlans && initialPlans.length ? initialPlans : [...PLUS_PLANS, ...PRO_PLANS]
  );
  const lastPlansHashRef = useRef(JSON.stringify(runtimePlans));
  const hasInitialPlans = Boolean(initialPlans && initialPlans.length);

  useEffect(() => {
    let cancelled = false;

    async function syncPlans() {
      try {
        const res = await fetch("/api/public/store-config", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) return;

        const json = (await res.json()) as {
          plans?: Array<
            RuntimePlan & {
              id?: string;
              productId?: ProductId;
            }
          >;
        };

        const nextPlans = (json.plans ?? []).filter(
          (p): p is RuntimePlan =>
            Boolean(p?.id) && (p.productId === "chatgpt-plus" || p.productId === "chatgpt-pro")
        );
        if (!nextPlans.length) return;

        const nextHash = JSON.stringify(nextPlans);
        if (!cancelled && nextHash !== lastPlansHashRef.current) {
          lastPlansHashRef.current = nextHash;
          setRuntimePlans(nextPlans);
        }
      } catch {
        // Тихий фолбэк: оставляем текущие цены, если API временно недоступен.
      }
    }

    // Не блокируем первый рендер: статические тарифы уже на странице.
    const firstSyncDelayMs = hasInitialPlans ? 8_000 : 800;
    const firstSyncTimer = window.setTimeout(() => {
      void syncPlans();
    }, firstSyncDelayMs);
    const intervalId = window.setInterval(() => {
      void syncPlans();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearTimeout(firstSyncTimer);
      window.clearInterval(intervalId);
    };
  }, [hasInitialPlans]);

  const plans = useMemo(
    () =>
      runtimePlans.filter(
        (p) => p.productId === activeProduct && p.inStock !== false,
      ),
    [runtimePlans, activeProduct]
  );
  const product = PRODUCTS.find((p) => p.id === activeProduct)!;
  const isProDualCompare =
    activeProduct === "chatgpt-pro" && plans.length >= 2 && plans.every((p) => p.productId === "chatgpt-pro");
  const isPlusTripleCompare =
    activeProduct === "chatgpt-plus" &&
    plans.length >= 3 &&
    plans.every((p) => p.productId === "chatgpt-plus");

  return (
    <section id="pricing" className="relative overflow-x-hidden overflow-hidden py-20 md:py-28">
      {/* Subtle gradient */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(16,163,127,0.05) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 md:px-6">
        {/* Heading */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="mb-12 flex flex-col items-center gap-3 text-center"
        >
          <span className="inline-flex items-center rounded-full border border-[#10a37f]/20 bg-[#10a37f]/8 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#10a37f]">
            Тарифы
          </span>
          <h2 className="font-heading text-3xl font-bold text-gray-900 md:text-4xl">
            Выберите формат подключения — от Plus до Pro
          </h2>
          <p className="max-w-2xl text-lg text-gray-500">
            Plus — для ежедневной работы. Pro — для максимальных лимитов. Оплата в рублях, гарантия на весь срок.
          </p>
        </motion.div>

        <TariffChooseGuide
          theme="gpt"
          items={GPT_TARIFF_GUIDE_ITEMS}
          supportHref="/dashboard/chat?site=gpt-store"
        />

        {/* Product switcher */}
        <div className="mb-10 flex justify-center">
          <div className="flex w-full max-w-sm gap-1 rounded-2xl border border-black/[0.08] bg-white p-1.5 sm:w-auto sm:max-w-none">
            {PRODUCTS.map((prod) => (
              <motion.button
                key={prod.id}
                onClick={() => setActiveProduct(prod.id)}
                className="relative flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors duration-200 sm:flex-none md:px-6 md:py-2.5 md:text-sm"
                style={{ color: activeProduct === prod.id ? "white" : "#6b7280" }}
              >
                {activeProduct === prod.id && (
                  <motion.div
                    layoutId="product-tab-bg"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: product.accentColor }}
                    transition={{ type: "spring", duration: 0.4 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {prod.name}
                  {prod.badge && (
                    <span className="rounded-full bg-orange-400 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {prod.badge}
                    </span>
                  )}
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Описание продукта + чипы */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeProduct + "-desc"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className={`mx-auto w-full max-w-5xl ${isProDualCompare || isPlusTripleCompare ? "mb-10" : "mb-12"}`}
          >
            <div className="flex flex-col items-center justify-center gap-4 text-center sm:flex-row md:gap-8">
              <p className="max-w-xl text-base leading-relaxed text-gray-600 sm:text-left">{product.description}</p>
              <div className="flex shrink-0 flex-wrap justify-center gap-2 sm:justify-end">
                {product.features.map((f) => (
                  <span
                    key={f}
                    className="rounded-full border px-2.5 py-1 text-xs font-medium"
                    style={{
                      color: product.accentColor,
                      background: product.glowColor,
                      borderColor: `${product.accentColor}30`,
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Plus: три варианта — наглядно чем отличаются */}
        {isPlusTripleCompare && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.35 }}
            className="mb-10"
          >
            <p className="mb-4 hidden text-center text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 md:block">
              Три тарифа — готовый аккаунт, подключение на ваш или ускорение
            </p>
            <div className="mx-auto hidden max-w-6xl gap-4 md:grid md:grid-cols-3 md:gap-4">
              <div className="relative overflow-hidden rounded-2xl border-2 border-sky-400/70 bg-gradient-to-br from-sky-50 via-white to-white p-4 shadow-md shadow-sky-500/10 md:p-5">
                <p className="relative text-xs font-bold uppercase tracking-wider text-sky-700">Готовый аккаунт</p>
                <p className="relative mt-1 font-heading text-base font-bold text-sky-950 md:text-lg">
                  Plus уже активирован
                </p>
                <p className="relative mt-2 text-xs leading-relaxed text-sky-900/90 md:text-sm">
                  Получаете готовый аккаунт с данными для входа. Не для подключения на ваш текущий ChatGPT.
                </p>
                <div className="relative mt-3 flex h-2 overflow-hidden rounded-full bg-sky-200/70">
                  <div className="h-full w-[55%] rounded-full bg-sky-500" />
                </div>
                <p className="relative mt-1.5 text-[10px] font-medium text-sky-700 md:text-[11px]">Выдача: через оператора</p>
              </div>
              <div className="relative overflow-hidden rounded-2xl border-2 border-[#10a37f]/85 bg-gradient-to-br from-emerald-50/95 via-white to-white p-4 shadow-lg shadow-emerald-600/15 ring-2 ring-[#10a37f]/20 md:p-5">
                <span className="relative inline-flex rounded-full bg-[#10a37f] px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow-sm">
                  Главный выбор
                </span>
                <p className="relative mt-2 text-xs font-bold uppercase tracking-wider text-emerald-800">Популярный</p>
                <p className="relative mt-1 font-heading text-base font-bold text-gray-900 md:text-lg">
                  На ваш аккаунт
                </p>
                <p className="relative mt-2 text-xs leading-relaxed text-gray-700 md:text-sm">
                  Универсальный вариант для ежедневного использования — подключение Plus на ваш ChatGPT.
                </p>
                <div className="relative mt-3 flex h-2 overflow-hidden rounded-full bg-emerald-100">
                  <div className="h-full w-[72%] rounded-full bg-[#10a37f]" />
                </div>
                <p className="relative mt-1.5 text-[10px] font-medium text-emerald-800 md:text-[11px]">Очередь: общая</p>
              </div>
              <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/75 bg-gradient-to-br from-amber-50/80 via-white to-orange-50/35 p-4 shadow-md shadow-amber-500/12 ring-1 ring-amber-300/40 md:p-5">
                <span className="relative inline-flex rounded-full border border-amber-400/90 bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950">
                  Приоритет скорости
                </span>
                <p className="relative mt-2 text-xs font-bold uppercase tracking-wider text-orange-900">Быстрая активация</p>
                <p className="relative mt-1 font-heading text-base font-bold text-orange-950 md:text-lg">
                  Вне очереди — быстрее
                </p>
                <p className="relative mt-2 text-xs leading-relaxed text-orange-950/90 md:text-sm">
                  Приоритетное подключение: обычно 5–15 минут после передачи данных, без ожидания общей очереди.
                </p>
                <div className="relative mt-3 flex h-2 overflow-hidden rounded-full bg-amber-200/80">
                  <div className="h-full w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500" />
                </div>
                <p className="relative mt-1.5 text-[10px] font-medium text-orange-900 md:text-[11px]">Очередь: приоритет</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Pro 5x vs 20x — явное сравнение перед карточками */}
        {isProDualCompare && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.35 }}
            className="mb-10"
          >
            <p className="mb-4 hidden text-center text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 md:block">
              Одинаковые функции — разные лимиты
            </p>
            <div className="mx-auto hidden w-full max-w-5xl auto-rows-fr grid-cols-1 gap-6 md:grid md:grid-cols-2 md:items-stretch">
              <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border-2 border-sky-400/70 bg-gradient-to-br from-sky-50 via-white to-white p-5 shadow-md shadow-sky-500/10 md:p-6">
                <div className="absolute right-2 top-1 text-[4.75rem] font-black leading-none text-sky-300/95 drop-shadow-[0_2px_10px_rgba(14,165,233,0.22)] select-none md:text-[5rem]">
                  5×
                </div>
                <div className="relative flex min-h-[1.375rem] items-center">
                  <span className="invisible rounded-full px-2 py-0.5 text-[10px] font-bold uppercase">Максимум</span>
                </div>
                <p className="relative mt-2 text-xs font-bold uppercase tracking-wider text-sky-700">Pro 5x</p>
                <p className="relative mt-1 font-heading text-xl font-bold text-sky-950 md:text-2xl">
                  Лимиты ≈ в 5 раз выше Plus
                </p>
                <p className="relative mt-2 flex-1 text-sm leading-relaxed text-sky-900/85 md:min-h-[4.5rem]">
                  Для активной работы несколько часов в день: тексты, код, повседневные задачи. Иногда можно упереться в
                  лимит.
                </p>
                <div className="relative mt-4 shrink-0 flex h-2.5 overflow-hidden rounded-full bg-sky-200/60">
                  <div className="h-full w-[28%] rounded-full bg-sky-500" title="относительная нагрузка" />
                </div>
                <p className="relative mt-1.5 shrink-0 text-[11px] font-medium text-sky-700/80">Нагрузка: умеренная</p>
              </div>
              <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border-2 border-emerald-600/80 bg-gradient-to-br from-emerald-50 via-white to-amber-50/40 p-5 shadow-md shadow-emerald-600/12 ring-1 ring-amber-400/30 md:p-6">
                <div className="absolute right-2 top-1 text-[4.75rem] font-black leading-none text-emerald-300/95 drop-shadow-[0_2px_10px_rgba(5,150,105,0.22)] select-none md:text-[5rem]">
                  20×
                </div>
                <div className="relative flex min-h-[1.375rem] items-center">
                  <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950">
                    Максимум
                  </span>
                </div>
                <p className="relative mt-2 text-xs font-bold uppercase tracking-wider text-emerald-800">Pro 20x</p>
                <p className="relative mt-1 font-heading text-xl font-bold text-emerald-950 md:text-2xl">
                  Лимиты ≈ в 20 раз выше Plus
                </p>
                <p className="relative mt-2 flex-1 text-sm leading-relaxed text-emerald-950/90 md:min-h-[4.5rem]">
                  Почти безлимит: целый день без остановки. Бизнес, автоматизация, несколько проектов — когда лимиты
                  реально мешают работе.
                </p>
                <div className="relative mt-4 shrink-0 flex h-2.5 overflow-hidden rounded-full bg-emerald-200/50">
                  <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" />
                </div>
                <p className="relative mt-1.5 shrink-0 text-[11px] font-medium text-emerald-800/90">Нагрузка: высокая / без остановки</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Plan cards */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeProduct + "-plans"}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
            className={
              isProDualCompare
                ? "mx-auto grid w-full max-w-5xl auto-rows-fr grid-cols-1 gap-6 md:grid-cols-2 md:items-stretch"
                : "grid grid-cols-1 gap-6 md:grid-cols-3"
            }
          >
            {plans.map((plan, index) => {
              const isInStock = plan.inStock !== false;
              const original = plan.original_price ?? plan.price;
              const displayPrice = plan.price;
              const discountLabel = plan.landing_discount_name ?? null;
              const showDiscount = original > displayPrice;
              const ctaText =
                plan.price > 0
                  ? `Подключить за ${displayPrice.toLocaleString("ru")} ${plan.currency}`
                  : plan.cta;

              const proTier = plan.id === "pro-5x" ? "5x" : plan.id === "pro-20x" ? "20x" : null;
              const plusTier =
                plan.productId === "chatgpt-plus"
                  ? plan.id === "plus-ready"
                    ? "ready"
                    : plan.id === "plus-fast"
                      ? "fast"
                      : plan.id === "plus-std"
                        ? "std"
                        : plan.id === "plus-new"
                          ? "new"
                          : null
                  : null;

              const proCardShell =
                proTier === "5x"
                  ? "border-2 border-sky-400/80 shadow-md shadow-sky-500/10"
                  : proTier === "20x"
                    ? "border-2 border-emerald-600/85 shadow-md shadow-emerald-600/10"
                    : "";
              const plusCardShell =
                plusTier === "ready"
                  ? "border-2 border-sky-400/75 shadow-md shadow-sky-500/10"
                  : plusTier === "fast"
                    ? "border-2 border-amber-500/75 ring-1 ring-amber-300/45 shadow-md shadow-amber-500/10"
                    : plusTier === "std"
                      ? "border-2 border-[#10a37f]/85 ring-2 ring-emerald-200/50 shadow-lg shadow-emerald-600/12"
                      : plusTier === "new"
                        ? "border border-slate-200/95 bg-slate-50/30 ring-1 ring-slate-100/90"
                        : "";
              const tierShell = proCardShell || plusCardShell;

              const proGlow =
                proTier === "5x"
                  ? "rgba(14, 165, 233, 0.12)"
                  : proTier === "20x"
                    ? "rgba(5, 150, 105, 0.14)"
                    : product.glowColor;
              const plusGlow =
                plusTier === "ready"
                  ? "rgba(14, 165, 233, 0.14)"
                  : plusTier === "fast"
                    ? "rgba(234, 88, 12, 0.14)"
                    : plusTier === "std"
                      ? "rgba(16, 163, 127, 0.18)"
                      : plusTier === "new"
                        ? "rgba(71, 85, 105, 0.14)"
                        : product.glowColor;

              const proAccent = proTier === "5x" ? "#0284c7" : proTier === "20x" ? "#059669" : product.accentColor;
              const plusAccent =
                plusTier === "ready"
                  ? "#0284c7"
                  : plusTier === "fast"
                    ? "#c2410c"
                    : plusTier === "std"
                      ? "#10a37f"
                      : plusTier === "new"
                        ? "#475569"
                        : product.accentColor;

              const cardAccent = proTier ? proAccent : plusTier ? plusAccent : product.accentColor;
              const cardGlow = proTier ? proGlow : plusTier ? plusGlow : product.glowColor;

              const isHovered = hoveredPlanId === plan.id;
              const hoverDetails =
                PLAN_HOVER_DETAILS[plan.id] ??
                [
                  plan.description,
                  plan.features[0] ?? "",
                  plan.features[1] ?? "",
                ].filter(Boolean);

              const articleShadow = (() => {
                if (proTier) {
                  if (plan.isPopular)
                    return {
                      boxShadow: `0 0 0 4px ${proGlow}, 0 12px 40px -12px rgba(5,150,105,0.22)`,
                    };
                  if (proTier === "20x")
                    return {
                      boxShadow: `0 8px 30px -10px rgba(5, 150, 105, 0.14)`,
                    };
                  return {
                    boxShadow: `0 8px 30px -10px rgba(14, 165, 233, 0.14)`,
                  };
                }
                if (plusTier) {
                  if (plusTier === "std" && plan.isPopular)
                    return {
                      boxShadow: `0 0 0 4px ${plusGlow}, 0 18px 52px -14px rgba(16, 163, 127, 0.28)`,
                    };
                  if (plusTier === "fast")
                    return {
                      boxShadow: `0 0 0 3px rgba(251, 146, 60, 0.2), 0 12px 38px -12px rgba(234, 88, 12, 0.18)`,
                    };
                  if (plusTier === "std")
                    return { boxShadow: `0 8px 24px -14px rgba(15, 23, 42, 0.06)` };
                  if (plusTier === "ready")
                    return {
                      boxShadow: `0 8px 30px -10px rgba(14, 165, 233, 0.14)`,
                    };
                  if (plusTier === "new") return { boxShadow: `0 6px 20px -12px rgba(71, 85, 105, 0.08)` };
                }
                if (plan.isPopular)
                  return {
                    border: `1.5px solid ${product.accentColor}`,
                    boxShadow: `0 0 0 4px ${product.glowColor}`,
                  };
                return { border: "1px solid rgba(0,0,0,0.08)" };
              })();

              const mobileHint =
                isPlusTripleCompare && PLUS_MOBILE_COMPARE[plan.id]
                  ? PLUS_MOBILE_COMPARE[plan.id]
                  : isProDualCompare && PRO_MOBILE_COMPARE[plan.id]
                    ? PRO_MOBILE_COMPARE[plan.id]
                    : null;

              return (
              <div key={plan.id} className="flex flex-col">
              {mobileHint ? (
                <MobileTariffCompareHint text={mobileHint.text} shell={mobileHint.shell} />
              ) : null}
              <motion.article
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08, duration: 0.4 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                onHoverStart={() => setHoveredPlanId(plan.id)}
                onHoverEnd={() => setHoveredPlanId((prev) => (prev === plan.id ? null : prev))}
                onFocusCapture={() => setHoveredPlanId(plan.id)}
                onBlurCapture={() => setHoveredPlanId((prev) => (prev === plan.id ? null : prev))}
                className={`relative flex flex-col rounded-2xl bg-white p-7 shadow-sm ${tierShell} ${isProDualCompare ? "h-full min-h-0" : ""}`}
                style={articleShadow}
              >
                {(plan.badge || !isInStock) && (
                  <div className="absolute -top-3.5 left-1/2 flex -translate-x-1/2 flex-wrap justify-center gap-1">
                    {plan.badge && (
                    <span
                      className="rounded-full px-4 py-1 text-xs font-bold text-white"
                      style={{ background: cardAccent }}
                    >
                      {plan.badge}
                    </span>
                    )}
                    {!isInStock && (
                      <span className="rounded-full bg-red-500 px-3 py-1 text-[10px] font-bold text-white">
                        Нет в наличии
                      </span>
                    )}
                  </div>
                )}

                <div className={`mb-6 shrink-0 ${isProDualCompare ? "min-h-[4.25rem]" : ""}`}>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-gray-700">{plan.name}</p>
                    {proTier === "5x" && (
                      <span className="rounded-md bg-sky-100 px-2 py-0.5 font-heading text-xs font-black text-sky-800 ring-1 ring-sky-300/60">
                        ×5 к Plus
                      </span>
                    )}
                    {proTier === "20x" && (
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-heading text-xs font-black text-emerald-900 ring-1 ring-emerald-400/70">
                        ×20 к Plus
                      </span>
                    )}
                    {plusTier === "ready" && (
                      <span className="rounded-md bg-sky-100 px-2 py-0.5 font-heading text-xs font-bold text-sky-900 ring-1 ring-sky-300/70">
                        Готовый вход
                      </span>
                    )}
                    {plusTier === "new" && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-heading text-xs font-bold text-slate-800 ring-1 ring-slate-300/70">
                        Новый аккаунт
                      </span>
                    )}
                    {plusTier === "std" && (
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-heading text-xs font-bold text-emerald-900 ring-1 ring-[#10a37f]/35">
                        Универсально
                      </span>
                    )}
                    {plusTier === "fast" && (
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 font-heading text-xs font-bold text-orange-900 ring-1 ring-amber-400/80">
                        Вне очереди
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    {plan.price > 0 ? (
                      <>
                        {showDiscount && (
                          <span className="font-heading text-lg font-semibold text-gray-400 line-through">
                            {original.toLocaleString("ru")}
                          </span>
                        )}
                        <span className="font-heading text-4xl font-bold text-gray-900">
                          {displayPrice.toLocaleString("ru")}
                        </span>
                        <span className="text-lg text-gray-400">{plan.currency}</span>
                      </>
                    ) : (
                      <span className="font-heading text-2xl font-bold text-gray-400">
                        Уточняйте цену
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex min-h-[1.5rem] items-center justify-between gap-2">
                    <p className="text-xs text-gray-400">/ {plan.period}</p>
                    {showDiscount && discountLabel ? (
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 ring-1 ring-amber-300/80">
                        <span className="text-xs font-extrabold uppercase tracking-wide text-amber-800">Скидка</span>
                        <span className="text-[11px] font-semibold text-amber-700">{discountLabel}</span>
                      </div>
                    ) : (
                      <span className="invisible inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs">
                        Скидка
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-gray-500">{plan.description}</p>
                  {plan.id === "plus-ready" ? (
                    <p className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                      {PLUS_READY_CHECKOUT_WARNING}
                    </p>
                  ) : null}
                </div>

                <ul className={`flex-1 space-y-2.5 ${isProDualCompare ? "mb-0" : "mb-8"}`}>
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span
                        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                        style={{ background: cardGlow }}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path
                            d="M1.5 4l2 2 3-3"
                            stroke={cardAccent}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span className="text-sm text-gray-600">{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="relative mt-auto shrink-0 pt-2">
                  {plan.price > 0 && isInStock ? (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <ConnectCheckoutButton
                        siteSlug="gpt-store"
                        planId={plan.id}
                        planName={plan.name}
                        className={`shimmer-btn flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm transition-all ${
                          proTier ? "font-extrabold" : "font-semibold"
                        }`}
                        style={
                          plan.isPopular
                            ? {
                                background: cardAccent,
                                color: "white",
                                boxShadow:
                                  activeProduct === "chatgpt-pro"
                                    ? `0 8px 32px -4px ${proTier === "20x" ? "rgba(5,150,105,0.45)" : cardGlow}, 0 2px 8px rgba(0,0,0,0.08)`
                                    : `0 8px 32px -4px rgba(16,163,127,0.4), 0 2px 8px rgba(0,0,0,0.06)`,
                              }
                            : proTier
                              ? {
                                  background: proTier === "5x" ? "#0284c7" : "#059669",
                                  color: "white",
                                  border: "1.5px solid transparent",
                                  boxShadow:
                                    proTier === "5x"
                                      ? "0 6px 20px -8px rgba(2,132,199,0.45)"
                                      : "0 6px 20px -8px rgba(5,150,105,0.45)",
                                }
                              : plusTier === "fast"
                                ? {
                                    background: "#f97316",
                                    color: "white",
                                    border: "1.5px solid transparent",
                                    boxShadow: "0 6px 20px -8px rgba(249,115,22,0.45)",
                                  }
                                : {
                                    background: "transparent",
                                    border: `1.5px solid ${proTier || plusTier ? `${cardAccent}55` : "rgba(0,0,0,0.12)"}`,
                                    color: proTier || plusTier ? cardAccent : "#374151",
                                  }
                        }
                      >
                        {ctaText}
                      </ConnectCheckoutButton>
                    </motion.div>
                  ) : (
                    <span className="flex h-11 w-full items-center justify-center rounded-xl border border-black/[0.12] bg-gray-100 px-4 text-sm font-semibold text-gray-500">
                      {isInStock ? "Уточняйте цену" : "Временно нет в наличии"}
                    </span>
                  )}
                </div>

                <AnimatePresence initial={false}>
                  {isHovered && (
                    <motion.div
                      key={`${plan.id}-hover-info`}
                      initial={{ height: 0, opacity: 0, y: 8 }}
                      animate={{ height: "auto", opacity: 1, y: 0 }}
                      exit={{ height: 0, opacity: 0, y: 8 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div
                        className="mt-3 rounded-xl border px-3 py-3"
                        style={{
                          borderColor: `${cardAccent}44`,
                          background: cardGlow,
                        }}
                      >
                        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: cardAccent }}>
                          Подробнее о подписке
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {hoverDetails.map((detail) => (
                            <li key={detail} className="text-xs leading-relaxed text-gray-700">
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
            })}
          </motion.div>
        </AnimatePresence>

        <p className="mt-8 text-center text-sm text-gray-400">
          Оплата через Pally, СБП и банковскую карту РФ — без иностранной карты
        </p>
      </div>
    </section>
  );
}
