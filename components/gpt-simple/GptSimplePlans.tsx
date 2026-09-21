"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Crown, Plane, Star } from "lucide-react";

import { ConnectCheckoutButton } from "@/components/checkout/ConnectCheckoutButton";
import type { ExtendedPlan } from "@/lib/chatgpt-data";
import { mergeGptStorefrontPlans } from "@/lib/landing/gpt-storefront-plans";
import { cn } from "@/lib/utils";

type PlanRow = ExtendedPlan & {
  original_price?: number;
  landing_discount_name?: string | null;
};

function formatRub(price: number): string {
  const n = Number(price);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("ru")} ₽`;
}

function PlanPrice({ plan }: { plan: PlanRow }) {
  const original = plan.original_price;
  const showOld = typeof original === "number" && original > plan.price;
  return (
    <div className="mt-3">
      {showOld ? (
        <p className="text-xs font-semibold text-gray-400 line-through">{formatRub(original)}</p>
      ) : null}
      <p className="font-heading text-2xl font-bold text-[#10a37f]">{formatRub(plan.price)}</p>
      {plan.landing_discount_name ? (
        <p className="mt-0.5 text-[11px] font-medium text-[#0f7d62]">{plan.landing_discount_name}</p>
      ) : null}
    </div>
  );
}

function ConnectBtn({ plan, skipAuthGate }: { plan: PlanRow; skipAuthGate: boolean }) {
  return (
    <ConnectCheckoutButton
      siteSlug="gpt-store"
      planId={plan.id}
      planName={plan.name}
      trackSource="landing_simple_plans"
      skipAuthGate={skipAuthGate}
      className="mt-auto inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-[#10a37f] px-3 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(16,163,127,0.28)] transition-opacity hover:opacity-90"
    >
      Подключить за {formatRub(plan.price)}
    </ConnectCheckoutButton>
  );
}

export function GptSimplePlans({
  initialPlans,
  skipAuthGate = false,
}: {
  initialPlans: ExtendedPlan[];
  skipAuthGate?: boolean;
}) {
  const plans = useMemo(() => mergeGptStorefrontPlans(initialPlans) as PlanRow[], [initialPlans]);
  const go = plans.find((p) => p.id === "go-1m");
  const plusStd = plans.find((p) => p.id === "plus-std");
  const plusFast = plans.find((p) => p.id === "plus-fast");
  const pro5 = plans.find((p) => p.id === "pro-5x");
  const pro20 = plans.find((p) => p.id === "pro-20x");

  const [plusId, setPlusId] = useState<"plus-std" | "plus-fast">("plus-std");
  const [proId, setProId] = useState<"pro-5x" | "pro-20x">("pro-5x");

  const plusPlan = plusId === "plus-fast" ? plusFast : plusStd;
  const proPlan = proId === "pro-20x" ? pro20 : pro5;

  return (
    <section id="plans" className="px-4 pb-6 pt-8 md:px-6 md:pb-10 md:pt-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <h2 className="font-heading text-3xl font-bold text-gray-900 md:text-4xl">Тарифы</h2>
          <p className="mt-2 text-sm text-gray-500 md:text-base">Выберите вариант под свои задачи</p>
        </div>

        <div className="grid items-start gap-3 md:grid-cols-3 md:gap-4">
          {go ? (
            <article className="flex flex-col rounded-2xl border border-black/[0.08] bg-white p-4 shadow-sm">
              <Plane className="h-8 w-8 text-[#10a37f]" strokeWidth={2} aria-hidden />
              <h2 className="font-heading mt-2 text-lg font-bold text-gray-900">ChatGPT Go</h2>
              <p className="mt-1 text-sm text-gray-500">
                Больше, чем бесплатный ChatGPT. Со входом в ваш аккаунт.
              </p>
              <PlanPrice plan={go} />
              <div className="mt-3">
                <ConnectBtn plan={go} skipAuthGate={skipAuthGate} />
              </div>
            </article>
          ) : null}

          {plusPlan && plusStd && plusFast ? (
            <article className="relative flex flex-col rounded-2xl border-2 border-[#10a37f] bg-white p-4 shadow-md">
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[#b8f05c] px-3 py-0.5 text-[11px] font-semibold text-[#1f3d12]">
                Самый популярный
              </span>
              <Star className="mt-1 h-8 w-8 rounded-md bg-[#10a37f] p-1.5 text-white" strokeWidth={2} aria-hidden />
              <h2 className="font-heading mt-2 text-lg font-bold text-gray-900">ChatGPT Plus</h2>
              <p className="mt-1 text-sm text-gray-500">Со входом в ваш ChatGPT или без входа.</p>
              <div className="mt-3 space-y-1.5">
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2",
                    plusId === "plus-std" ? "border-[#10a37f] bg-[#10a37f]/6" : "border-black/[0.08]",
                  )}
                >
                  <input
                    type="radio"
                    name="plus-mode"
                    className="mt-0.5 accent-[#10a37f]"
                    checked={plusId === "plus-std"}
                    onChange={() => setPlusId("plus-std")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold leading-snug text-gray-900">
                        Подключение со входом в аккаунт
                      </span>
                      <span className="shrink-0 text-xs font-bold text-gray-900">{formatRub(plusStd.price)}</span>
                    </span>
                    <span className="mt-0.5 block text-[11px] text-gray-500">Нужен вход в ваш ChatGPT</span>
                  </span>
                </label>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2",
                    plusId === "plus-fast" ? "border-[#10a37f] bg-[#10a37f]/6" : "border-black/[0.08]",
                  )}
                >
                  <input
                    type="radio"
                    name="plus-mode"
                    className="mt-0.5 accent-[#10a37f]"
                    checked={plusId === "plus-fast"}
                    onChange={() => setPlusId("plus-fast")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold leading-snug text-gray-900">
                        Подключение без входа в аккаунт
                      </span>
                      <span className="shrink-0 text-xs font-bold text-gray-900">{formatRub(plusFast.price)}</span>
                    </span>
                    <span className="mt-0.5 block text-[11px] text-gray-500">Вход в ваш ChatGPT не нужен</span>
                  </span>
                </label>
              </div>
              <div className="mt-3">
                <ConnectBtn plan={plusPlan} skipAuthGate={skipAuthGate} />
              </div>
            </article>
          ) : null}

          {proPlan && pro5 && pro20 ? (
            <article className="flex flex-col rounded-2xl border border-black/[0.08] bg-white p-4 shadow-sm">
              <Crown className="h-8 w-8 text-[#7c3aed]" strokeWidth={2} aria-hidden />
              <h2 className="font-heading mt-2 text-lg font-bold text-gray-900">ChatGPT Pro</h2>
              <p className="mt-1 text-sm text-gray-500">Максимум лимитов. Со входом в ваш аккаунт.</p>
              <div className="mt-3 space-y-1.5">
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2",
                    proId === "pro-20x" ? "border-[#10a37f] bg-[#10a37f]/6" : "border-black/[0.08]",
                  )}
                >
                  <input
                    type="radio"
                    name="pro-mode"
                    className="mt-0.5 accent-[#10a37f]"
                    checked={proId === "pro-20x"}
                    onChange={() => setProId("pro-20x")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold leading-snug text-gray-900">
                        ChatGPT Pro 20x — Максимальный
                      </span>
                      <span className="shrink-0 text-xs font-bold text-gray-900">{formatRub(pro20.price)}</span>
                    </span>
                  </span>
                </label>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2",
                    proId === "pro-5x" ? "border-[#10a37f] bg-[#10a37f]/6" : "border-black/[0.08]",
                  )}
                >
                  <input
                    type="radio"
                    name="pro-mode"
                    className="mt-0.5 accent-[#10a37f]"
                    checked={proId === "pro-5x"}
                    onChange={() => setProId("pro-5x")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold leading-snug text-gray-900">
                        ChatGPT Pro 5x — Популярный
                      </span>
                      <span className="shrink-0 text-xs font-bold text-gray-900">{formatRub(pro5.price)}</span>
                    </span>
                  </span>
                </label>
              </div>
              <details className="group mt-2 rounded-lg border border-black/[0.08] px-2.5 py-2">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-medium text-gray-700 marker:content-none [&::-webkit-details-marker]:hidden">
                  Чем отличается 5× от 20×?
                  <ChevronDown
                    className="h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="mt-2 border-t border-black/[0.06] pt-2 text-[11px] leading-relaxed text-gray-500">
                  Одинаковые функции Pro. 5× — для активной работы, 20× — для постоянной нагрузки.
                </p>
              </details>
              <div className="mt-3">
                <ConnectBtn plan={proPlan} skipAuthGate={skipAuthGate} />
              </div>
            </article>
          ) : null}
        </div>
      </div>
    </section>
  );
}
