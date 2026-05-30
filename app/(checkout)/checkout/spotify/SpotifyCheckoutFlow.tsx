"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { SPOTIFY_PLANS, SPOTIFY_ACCENT, SPOTIFY_GLOW, type SpotifyPlan } from "@/lib/content/spotify";
import { tryCreateSubsBrowserClient } from "@/lib/supabase/subs-browser-client";
import { cn } from "@/lib/utils";
import { formatPallyCheckoutError } from "@/lib/payments/pally-env-hint";
import { startCheckoutPaymentWait } from "@/lib/checkout/start-payment-wait";

const STEPS = ["Выбор тарифа", "Email аккаунта", "Оплата"];

const ACCOUNT_DATA_HINT =
  "После оплаты оператор уточнит данные, которые нужны именно для вашего варианта подключения. Обычно это email от Spotify-аккаунта, а в отдельных случаях может потребоваться временный доступ для активации.";

export function SpotifyCheckoutFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planIdFromUrl = searchParams.get("plan");
  const [step, setStep] = useState(1);
  const [plans, setPlans] = useState<SpotifyPlan[]>(SPOTIFY_PLANS);
  const [promoCodes, setPromoCodes] = useState<{ code: string; active: boolean }[]>([]);
  const [plansSource, setPlansSource] = useState<"static" | "supabase">("static");
  const [selectedPlan, setSelectedPlan] = useState<SpotifyPlan | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const plansHashRef = useRef(JSON.stringify(SPOTIFY_PLANS));
  const urlPlanInitDoneRef = useRef(false);
  const maxStepReachedRef = useRef(1);

  function goToStep(next: number) {
    maxStepReachedRef.current = Math.max(maxStepReachedRef.current, next);
    setStep(next);
  }

  function goBackToStep(next: number) {
    maxStepReachedRef.current = next;
    setStep(next);
  }

  useEffect(() => {
    async function loadPlans() {
      try {
        const r = await fetch("/api/public/subs-store-config", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as {
          plans?: SpotifyPlan[];
          promoCodes?: { code: string; active: boolean }[];
          source?: string;
        };
        const nextPlans = j.plans?.length ? j.plans : null;
        if (nextPlans) {
          const nextHash = JSON.stringify(nextPlans);
          if (nextHash !== plansHashRef.current) {
            plansHashRef.current = nextHash;
            setPlans(nextPlans);
            setPlansSource(j.source === "supabase" ? "supabase" : "static");
          }
        }
        if (j.promoCodes?.length) setPromoCodes(j.promoCodes.filter((p) => p.active));
      } catch {
        /* static fallback */
      }
    }

    void loadPlans();
    const id = window.setInterval(() => void loadPlans(), 5000);
    return () => window.clearInterval(id);
  }, []);

  // Только выбор тарифа из URL — шаг не трогаем (poll каждые 5 с)
  useEffect(() => {
    if (!planIdFromUrl || !plans.length) return;
    const found = plans.find((p) => p.id === planIdFromUrl);
    if (found) setSelectedPlan(found);
  }, [planIdFromUrl, plans]);

  // Один раз: с лендинга ?plan=… → шаг 2, но не откатывать если уже на 3
  useEffect(() => {
    if (!planIdFromUrl || urlPlanInitDoneRef.current || !plans.length) return;
    if (!plans.some((p) => p.id === planIdFromUrl)) return;
    urlPlanInitDoneRef.current = true;
    setStep((current) => (current > 1 ? current : 2));
    maxStepReachedRef.current = Math.max(maxStepReachedRef.current, 2);
  }, [planIdFromUrl, plans]);

  useEffect(() => {
    const subs = tryCreateSubsBrowserClient();
    if (!subs) {
      setReady(true);
      return;
    }
    void subs.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
      setReady(true);
    });
  }, []);

  const displayPrice = useMemo(() => selectedPlan?.price ?? 0, [selectedPlan]);

  function validateEmail(value: string) {
    if (!value.trim()) return "Введите email";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Некорректный email";
    return "";
  }

  function goToPaymentStep() {
    const err = validateEmail(email);
    if (err) {
      setEmailError(err);
      return;
    }
    goToStep(3);
  }

  async function handlePay() {
    if (!selectedPlan || !agreeTerms) return;
    const err = validateEmail(email);
    if (err) {
      setEmailError(err);
      goBackToStep(2);
      return;
    }

    setIsSubmitting(true);
    setPayError(null);
    try {
      const res = await fetch("/api/payments/subs-store/pally/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          planId: selectedPlan.id,
          accountEmail: email.trim(),
          promoCode: promoCode.trim().toUpperCase() || null,
        }),
      });
      const json = (await res.json()) as {
        paymentUrl?: string;
        error?: string;
        orderId?: string;
        orderSaved?: boolean;
      };
      if (json.orderId) {
        try {
          sessionStorage.setItem("subs-checkout-order", json.orderId);
        } catch {
          // private mode
        }
      }
      if (!res.ok || !json.paymentUrl) {
        const base = formatPallyCheckoutError(json.error ?? "Не удалось создать ссылку на оплату");
        setPayError(
          json.orderSaved && !/заказ сохранён/i.test(base)
            ? `${base} Заказ сохранён в админке — повторите оплату.`
            : base,
        );
        return;
      }
      if (!json.orderId) {
        setPayError("Не удалось привязать заказ к оплате. Попробуйте снова.");
        return;
      }
      startCheckoutPaymentWait({
        orderId: json.orderId,
        siteSlug: "subs-store",
        paymentUrl: json.paymentUrl,
        router,
      });
    } catch {
      setPayError("Ошибка сети. Попробуйте снова.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: SPOTIFY_ACCENT }} />
      </div>
    );
  }

  const planGridClass =
    plans.length >= 6
      ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      : plans.length >= 4
        ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2"
        : "grid grid-cols-1 gap-4 sm:grid-cols-2";

  return (
    <div className="flex w-full flex-1 flex-col">
      {process.env.NODE_ENV === "development" && plansSource === "static" && (
        <p
          className="mb-6 rounded-xl border px-4 py-3 text-xs"
          style={{ borderColor: "rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.08)", color: "rgba(253,230,138,0.9)" }}
        >
          Checkout: static fallback — проверьте SUBS_SUPABASE_URL и тарифы в Supabase.
        </p>
      )}

      <div className="mb-10 flex w-full flex-wrap items-center gap-3 md:gap-4">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const isDone = step > n;
          const isCurrent = step === n;
          return (
            <div key={label} className="flex flex-1 min-w-[140px] items-center gap-2 md:min-w-0">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    isDone ? "text-white" : isCurrent ? "text-[#1DB954]" : "text-white/30",
                  )}
                  style={
                    isDone
                      ? { background: SPOTIFY_ACCENT, border: `2px solid ${SPOTIFY_ACCENT}` }
                      : isCurrent
                        ? { border: `2px solid ${SPOTIFY_ACCENT}`, background: "rgba(29,185,84,0.12)" }
                        : { border: "2px solid rgba(255,255,255,0.12)", background: "transparent" }
                  }
                >
                  {isDone ? <Check size={14} /> : n}
                </div>
                <span
                  className={cn(
                    "text-sm",
                    isCurrent ? "font-semibold text-white" : isDone ? "text-white/70" : "text-white/40",
                  )}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="hidden h-px flex-1 md:block"
                  style={{ background: isDone ? SPOTIFY_ACCENT : "rgba(255,255,255,0.08)" }}
                />
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
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25 }}
            className="flex flex-1 flex-col"
          >
            <div className="mb-8">
              <span
                className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
                style={{ background: SPOTIFY_GLOW, border: "1px solid rgba(29,185,84,0.25)", color: SPOTIFY_ACCENT }}
              >
                <Sparkles size={12} />
                Spotify Premium
              </span>
              <h1 className="font-heading text-2xl font-bold text-white md:text-3xl lg:text-4xl">
                Выберите тариф
              </h1>
              <p className="mt-2 max-w-2xl text-sm md:text-base" style={{ color: "rgba(255,255,255,0.5)" }}>
                Тарифы синхронизированы с лендингом SPOTIFY STORE. Оплата в рублях, активация 10–15 минут.
              </p>
            </div>

            <div className={planGridClass}>
              {plans.map((plan) => {
                const selected = selectedPlan?.id === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className={cn(
                      "group relative rounded-2xl border p-5 text-left transition-all duration-200",
                      selected
                        ? "border-[#1DB954] shadow-[0_0_32px_rgba(29,185,84,0.18)]"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]",
                    )}
                    style={selected ? { background: "rgba(29,185,84,0.08)" } : undefined}
                  >
                    {plan.isPopular && (
                      <span
                        className="absolute -top-2.5 right-4 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                        style={{ background: SPOTIFY_ACCENT, color: "#0a0a0a" }}
                      >
                        Популярный
                      </span>
                    )}
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-white md:text-lg">{plan.name}</p>
                        {plan.description && (
                          <p className="mt-1.5 text-xs leading-relaxed md:text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                            {plan.description}
                          </p>
                        )}
                        {plan.shortDescription && (
                          <p className="mt-2 text-xs" style={{ color: SPOTIFY_ACCENT }}>
                            {plan.shortDescription}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        {plan.oldPrice != null && plan.oldPrice > plan.price && (
                          <p className="text-xs line-through" style={{ color: "rgba(255,255,255,0.35)" }}>
                            {plan.oldPrice.toLocaleString("ru")} ₽
                          </p>
                        )}
                        <p className="text-xl font-bold text-white md:text-2xl">
                          {plan.price.toLocaleString("ru")} ₽
                        </p>
                      </div>
                    </div>
                    {selected && (
                      <div
                        className="mt-4 flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: SPOTIFY_ACCENT }}
                      >
                        <Check size={14} />
                        Выбрано
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div
              className="mt-8 flex flex-col gap-4 border-t pt-8 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              {selectedPlan ? (
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Выбрано:{" "}
                  <span className="font-semibold text-white">
                    {selectedPlan.name} · {selectedPlan.price.toLocaleString("ru")} ₽
                  </span>
                </p>
              ) : (
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Выберите тариф, чтобы продолжить
                </p>
              )}
              <button
                type="button"
                disabled={!selectedPlan}
                onClick={() => goToStep(2)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-30 sm:w-auto sm:min-w-[220px]"
                style={{ background: SPOTIFY_ACCENT }}
              >
                Продолжить
                <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="mx-auto w-full max-w-2xl lg:max-w-3xl"
          >
            <h1 className="font-heading text-2xl font-bold text-white md:text-3xl">Email для связи</h1>
            <p className="mt-2 mb-8 text-sm md:text-base" style={{ color: "rgba(255,255,255,0.5)" }}>
              Укажите email — на него придут статусы заказа. После оплаты оператор свяжется в чате для активации Premium.
            </p>

            {selectedPlan && (
              <div
                className="mb-6 flex items-center justify-between rounded-2xl border p-4 md:p-5"
                style={{ borderColor: "rgba(29,185,84,0.3)", background: "rgba(29,185,84,0.1)" }}
              >
                <span className="font-medium text-white/90">
                  Spotify Premium · {selectedPlan.name}
                </span>
                <span className="text-xl font-bold text-white">
                  {selectedPlan.price.toLocaleString("ru")} ₽
                </span>
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/80">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError("");
                  }}
                  className={cn(
                    "w-full rounded-xl border bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30",
                    "focus:border-[#1DB954] focus:ring-2 focus:ring-[#1DB954]/25",
                    emailError ? "border-red-500/60" : "border-white/10",
                  )}
                  placeholder="your@email.com"
                />
                {emailError && <p className="mt-1.5 text-xs text-red-400">{emailError}</p>}
              </div>

              <p
                className="rounded-2xl border px-4 py-4 text-xs leading-relaxed md:text-sm"
                style={{
                  borderColor: "rgba(29,185,84,0.2)",
                  background: "rgba(29,185,84,0.06)",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                {ACCOUNT_DATA_HINT}
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => goBackToStep(1)}
                  className="rounded-xl px-6 py-3.5 text-sm text-white/60 transition-colors hover:text-white sm:flex-1"
                  style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  ← Назад
                </button>
                <button
                  type="button"
                  onClick={goToPaymentStep}
                  className="inline-flex flex-[2] items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white hover:opacity-90"
                  style={{ background: SPOTIFY_ACCENT }}
                >
                  Продолжить
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="mx-auto w-full max-w-2xl lg:max-w-3xl"
          >
            <h1 className="font-heading text-2xl font-bold text-white md:text-3xl">Оплата</h1>
            <p className="mt-2 mb-8 text-sm md:text-base" style={{ color: "rgba(255,255,255,0.5)" }}>
              Оплата через Pally, СБП и банковскую карту РФ — вы перейдёте на защищённую страницу провайдера.
            </p>

            {selectedPlan && (
              <div
                className="mb-6 flex items-center justify-between rounded-2xl border p-4 md:p-5"
                style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}
              >
                <span className="font-medium text-white/90">Spotify Premium · {selectedPlan.name}</span>
                <span className="text-xl font-bold text-white">{displayPrice.toLocaleString("ru")} ₽</span>
              </div>
            )}

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-white/80">Промокод (если есть)</label>
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Например: SALE10"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#1DB954] focus:ring-2 focus:ring-[#1DB954]/25"
              />
              {promoCodes.length > 0 && (
                <p className="mt-1.5 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Промокоды из админки SPOTIFY STORE применяются при оплате
                </p>
              )}
            </div>

            <label className="mb-6 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-[#1DB954]"
              />
              <span className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                Я принимаю{" "}
                <a href="/spotify/terms" className="hover:underline" style={{ color: SPOTIFY_ACCENT }} target="_blank" rel="noopener noreferrer">
                  публичную оферту
                </a>{" "}
                и{" "}
                <a href="/spotify/privacy" className="hover:underline" style={{ color: SPOTIFY_ACCENT }} target="_blank" rel="noopener noreferrer">
                  политику конфиденциальности
                </a>
              </span>
            </label>

            {payError && (
              <p className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {payError}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => goBackToStep(2)}
                className="rounded-xl px-6 py-3.5 text-sm text-white/60 transition-colors hover:text-white sm:flex-1"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }}
              >
                ← Назад
              </button>
              <button
                type="button"
                disabled={!agreeTerms || isSubmitting}
                onClick={() => void handlePay()}
                className="inline-flex flex-[2] items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
                style={{ background: SPOTIFY_ACCENT }}
              >
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                {isSubmitting ? "Создаём платёж..." : `Оплатить ${displayPrice.toLocaleString("ru")} ₽`}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
