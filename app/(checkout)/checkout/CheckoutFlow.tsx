"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { PLUS_PLANS, PRO_PLANS, PLUS_READY_CHECKOUT_WARNING, type ExtendedPlan } from "@/lib/chatgpt-data";
import { TokenSafetyBlock } from "@/components/ui/TokenSafetyBlock";
import { cn } from "@/lib/utils";
import { formatPallyCheckoutError } from "@/lib/payments/pally-env-hint";
import { startCheckoutPaymentWait } from "@/lib/checkout/start-payment-wait";
import { useCheckoutAuthGate } from "@/hooks/useCheckoutAuthGate";
import { trackGPTPayClick, trackGptSelectPlan } from "@/lib/metrics";
import { buildCheckoutAuthUrl, persistCheckoutIntent } from "@/lib/checkout/checkout-auth";

const ALL_PLANS = [...PLUS_PLANS, ...PRO_PLANS];

const STEPS = ["Выбор тарифа", "Оплата"];

export function CheckoutFlow({ initialPlans }: { initialPlans?: ExtendedPlan[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authGate = useCheckoutAuthGate("gpt-store");

  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<ExtendedPlan | null>(null);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftOrderId, setDraftOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runtimePlans, setRuntimePlans] = useState<ExtendedPlan[]>(
    (initialPlans && initialPlans.length ? initialPlans : ALL_PLANS).filter(
      (p) => p.inStock !== false,
    )
  );
  const plansHashRef = useRef(JSON.stringify(runtimePlans));
  const selectedPlanIdRef = useRef<string | null>(null);
  const urlPlanInitDoneRef = useRef(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!authGate.ready || !authGate.intent) return;
    if (authGate.intent.promoCode) {
      setPromoCode((prev) => prev || (authGate.intent!.promoCode ?? ""));
    }
  }, [authGate.ready, authGate.intent]);

  useEffect(() => {
    if (!authGate.ready || !selectedPlan) return;
    persistCheckoutIntent({
      siteSlug: "gpt-store",
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      promoCode: promoCode.trim() || null,
    });
  }, [authGate.ready, selectedPlan, promoCode]);

  // Предвыбор тарифа из URL (?plan=…) или checkout intent — цель один раз
  useEffect(() => {
    if (!authGate.ready || urlPlanInitDoneRef.current) return;
    const planId = searchParams.get("plan") ?? authGate.intent?.planId ?? null;
    if (!planId) return;
    const found = runtimePlans.find((p) => p.id === planId && p.inStock !== false);
    if (!found) return;
    urlPlanInitDoneRef.current = true;
    setSelectedPlan(found);
    setStep((current) => (current > 1 ? current : 2));
    trackGptSelectPlan(found.id, "checkout_url_or_intent");
  }, [searchParams, runtimePlans, authGate.ready, authGate.intent]);

  useEffect(() => {
    selectedPlanIdRef.current = selectedPlan?.id ?? null;
  }, [selectedPlan]);

  useEffect(() => {
    let cancelled = false;

    async function syncPlans() {
      try {
        const res = await fetch("/api/public/store-config", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { plans?: ExtendedPlan[] };
        const next = (json.plans ?? []).filter(
          (p) => p?.id && p.price > 0 && p.inStock !== false,
        );
        if (!next.length) return;
        const nextHash = JSON.stringify(next);
        if (!cancelled && nextHash !== plansHashRef.current) {
          plansHashRef.current = nextHash;
          setRuntimePlans(next);
          if (selectedPlanIdRef.current) {
            const fresh = next.find((p) => p.id === selectedPlanIdRef.current);
            if (fresh && fresh.inStock !== false) setSelectedPlan(fresh);
            if (!fresh || fresh.inStock === false) setSelectedPlan(null);
          }
        }
      } catch {
        // no-op
      }
    }

    const firstSyncTimer = window.setTimeout(() => {
      void syncPlans();
    }, 800);
    const id = window.setInterval(() => {
      void syncPlans();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearTimeout(firstSyncTimer);
      window.clearInterval(id);
    };
  }, []);

  async function saveDraftOrder() {
    if (!selectedPlan) return;
    try {
      const res = await fetch("/api/checkout/gpt/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          planId: selectedPlan.id,
          promoCode: promoCode.trim().toUpperCase() || null,
          orderId: draftOrderId,
        }),
      });
      const json = (await res.json()) as { orderId?: string; error?: string };
      if (res.ok && json.orderId) {
        setDraftOrderId(json.orderId);
      }
    } catch {
      // заказ в админке не критичен для UX шага оплаты
    }
  }

  async function onPaymentSubmit() {
    if (!selectedPlan || selectedPlan.inStock === false || !agreeTerms) return;
    if (submittingRef.current || isSubmitting) return;
    submittingRef.current = true;
    trackGPTPayClick(selectedPlan.id, "checkout_step2");
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/payments/pally/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          planId: selectedPlan.id,
          promoCode: promoCode.trim().toUpperCase() || null,
          orderId: draftOrderId,
        }),
      });

      const json = (await res.json()) as {
        paymentUrl?: string;
        error?: string;
        orderId?: string;
        orderSaved?: boolean;
      };

      if (json.orderId) {
        setDraftOrderId(json.orderId);
        try {
          sessionStorage.setItem("gpt-checkout-order", json.orderId);
        } catch {
          // private mode / blocked storage
        }
      }

      if (!res.ok || !json.paymentUrl || !json.orderId) {
        const base = formatPallyCheckoutError(json.error ?? "Платёжная ссылка недоступна");
        if (res.status === 401) {
          const ret = `/checkout?plan=${encodeURIComponent(selectedPlan.id)}`;
          router.push(buildCheckoutAuthUrl("gpt-store", ret));
          return;
        }
        if (json.orderSaved && !/заказ сохранён/i.test(base)) {
          setError(`${base} Заказ сохранён в админке — повторите оплату.`);
        } else {
          setError(base);
        }
        return;
      }

      startCheckoutPaymentWait({
        orderId: json.orderId,
        siteSlug: "gpt-store",
        paymentUrl: json.paymentUrl,
        router,
      });
    } catch {
      setError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  if (!authGate.ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#10a37f]" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      {/* Steps */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const isDone = step > n;
          const isCurrent = step === n;
          return (
            <div key={label} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                    isDone ? "bg-[#10a37f] text-white"
                    : isCurrent ? "border-2 border-[#10a37f] text-[#10a37f]"
                    : "border-2 border-gray-200 text-gray-400"
                  )}
                >
                  {isDone ? <Check size={12} /> : n}
                </div>
                <span className={cn("text-sm hidden sm:block", isCurrent ? "font-semibold text-gray-900" : "text-gray-400")}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("h-px w-8 sm:w-12", step > n ? "bg-[#10a37f]" : "bg-gray-200")} />
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            <h2 className="font-heading text-xl font-bold text-gray-900 mb-6">Выберите тариф</h2>
            <div className="space-y-3">
              {runtimePlans.filter((p) => p.price > 0 && p.inStock !== false).map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => {
                    if (plan.inStock === false) return;
                    setSelectedPlan(plan);
                    trackGptSelectPlan(plan.id, "checkout_step1");
                  }}
                  disabled={plan.inStock === false}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-70",
                    selectedPlan?.id === plan.id
                      ? "border-[#10a37f] bg-[#10a37f]/4 shadow-sm"
                      : "border-black/[0.08] bg-white hover:border-[#10a37f]/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{plan.name}</span>
                        {plan.badge && (
                          <span className="rounded-full bg-[#10a37f] px-2 py-0.5 text-[10px] font-bold text-white">
                            {plan.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-400">{plan.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-heading text-xl font-bold text-gray-900 whitespace-nowrap">
                        {plan.price.toLocaleString("ru")} ₽
                      </span>
                      <p className="text-xs text-gray-400">/ {plan.period}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {selectedPlan?.id === "plus-ready" ? (
              <p className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900">
                {PLUS_READY_CHECKOUT_WARNING}
              </p>
            ) : null}
            <button
              type="button"
              disabled={!selectedPlan || selectedPlan.inStock === false}
              onClick={() => {
                setStep(2);
                void saveDraftOrder();
              }}
              className="mt-6 flex w-full items-center justify-center rounded-xl bg-[#10a37f] py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Продолжить →
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            <h2 className="font-heading text-xl font-bold text-gray-900 mb-2">Оплата</h2>
            <p className="mb-5 text-sm text-gray-500">
              Оплата доступна через Pally, СБП и банковскую карту РФ — вы перейдёте на защищённую страницу
              провайдера.
            </p>

            <TokenSafetyBlock compact={true} className="mb-4" supportHref="/dashboard/chat" />

            {/* Summary */}
            {selectedPlan && (
              <div className="mb-5 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-black/[0.07] bg-gray-50 px-4 py-3">
                  <span className="text-sm text-gray-600">{selectedPlan.name}</span>
                  <span className="font-semibold text-gray-900 whitespace-nowrap">
                    {selectedPlan.price.toLocaleString("ru")} ₽
                  </span>
                </div>
                {selectedPlan.id === "plus-ready" ? (
                  <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900">
                    {PLUS_READY_CHECKOUT_WARNING}
                  </p>
                ) : null}
              </div>
            )}

            {/* Terms consent */}
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Промокод (если есть)</label>
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Например: SALE10"
                className="w-full rounded-xl border border-black/[0.12] px-3.5 py-2.5 text-sm outline-none transition-shadow focus:border-[#10a37f] focus:ring-2 focus:ring-[#10a37f]/30"
              />
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer mb-5">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#10a37f]"
              />
              <span className="text-xs text-gray-500 leading-relaxed">
                Я принимаю{" "}
                <a href="/terms" className="text-[#10a37f] hover:underline" target="_blank" rel="noopener noreferrer">
                  публичную оферту
                </a>{" "}
                и{" "}
                <a href="/privacy" className="text-[#10a37f] hover:underline" target="_blank" rel="noopener noreferrer">
                  политику конфиденциальности
                </a>
              </span>
            </label>

            {error && (
              <p className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-xl border border-black/[0.1] py-3 text-sm text-gray-600 hover:bg-gray-50"
              >
                ← Назад
              </button>
              <button
                type="button"
                disabled={!agreeTerms || isSubmitting}
                onClick={onPaymentSubmit}
                className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-[#10a37f] py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
              >
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                {isSubmitting ? "Создаём платёж..." : `Оплатить ${selectedPlan?.price.toLocaleString("ru")} ₽`}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
