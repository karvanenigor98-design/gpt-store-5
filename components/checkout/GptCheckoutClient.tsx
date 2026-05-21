"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ExtendedPlan } from "@/lib/chatgpt-data";
import { createClient } from "@/lib/supabase/client";

type Props = {
  plans: ExtendedPlan[];
};

export function GptCheckoutClient({ plans }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planIdFromUrl = searchParams.get("plan");

  const [selectedPlanId, setSelectedPlanId] = useState(planIdFromUrl ?? plans[0]?.id ?? "");
  const [accountEmail, setAccountEmail] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? plans[0],
    [plans, selectedPlanId],
  );

  useEffect(() => {
    if (planIdFromUrl) setSelectedPlanId(planIdFromUrl);
  }, [planIdFromUrl]);

  useEffect(() => {
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!data.user) {
          const ret = `/checkout${planIdFromUrl ? `?plan=${planIdFromUrl}` : ""}`;
          router.replace(`/login?returnUrl=${encodeURIComponent(ret)}`);
          return;
        }
        if (data.user.email) setAccountEmail(data.user.email);
        setAuthReady(true);
      });
  }, [router, planIdFromUrl]);

  async function handlePay() {
    if (!selectedPlan) {
      setError("Выберите тариф");
      return;
    }
    if (!accountEmail.trim()) {
      setError("Укажите email аккаунта ChatGPT");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/payments/pally/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          planId: selectedPlan.id,
          accountEmail: accountEmail.trim(),
          promoCode: promoCode.trim() || null,
        }),
      });
      const json = (await res.json()) as { paymentUrl?: string; error?: string };
      if (!res.ok || !json.paymentUrl) {
        setError(json.error ?? "Не удалось создать платёж");
        return;
      }
      window.location.href = json.paymentUrl;
    } catch {
      setError("Ошибка сети. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  }

  if (!authReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#10a37f]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4">
      <h1 className="font-heading mb-2 text-2xl font-bold text-gray-900">Оформление заказа</h1>
      <p className="mb-8 text-sm text-gray-500">GPT STORE · ChatGPT Plus / Pro</p>

      <label className="mb-2 block text-sm font-medium text-gray-700">Тариф</label>
      <select
        value={selectedPlanId}
        onChange={(e) => setSelectedPlanId(e.target.value)}
        className="mb-6 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm"
      >
        {plans.map((p) => (
          <option key={p.id} value={p.id} disabled={p.inStock === false}>
            {p.name} — {p.price} {p.currency}
            {p.inStock === false ? " (нет в наличии)" : ""}
          </option>
        ))}
      </select>

      <label className="mb-2 block text-sm font-medium text-gray-700">Email аккаунта ChatGPT</label>
      <input
        type="email"
        value={accountEmail}
        onChange={(e) => setAccountEmail(e.target.value)}
        className="mb-4 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm"
        placeholder="email@example.com"
      />

      <label className="mb-2 block text-sm font-medium text-gray-700">Промокод (необязательно)</label>
      <input
        type="text"
        value={promoCode}
        onChange={(e) => setPromoCode(e.target.value)}
        className="mb-6 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm"
        placeholder="PROMO"
      />

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={loading || selectedPlan?.inStock === false}
        onClick={() => void handlePay()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#10a37f] py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        Оплатить {selectedPlan ? `${selectedPlan.price} ${selectedPlan.currency}` : ""}
      </button>

      <p className="mt-6 text-center text-sm text-gray-500">
        <Link href="/" className="text-[#10a37f] hover:underline">
          ← На главную
        </Link>
      </p>
    </div>
  );
}
