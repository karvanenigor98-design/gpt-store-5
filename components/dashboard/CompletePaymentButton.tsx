"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SiteSlug = "gpt-store" | "subs-store";

type Props = {
  siteSlug: SiteSlug;
  orderId: string;
  planId: string;
  accountEmail: string;
  variant?: "gpt" | "subs";
};

export function CompletePaymentButton({
  siteSlug,
  orderId,
  planId,
  accountEmail,
  variant = siteSlug === "subs-store" ? "subs" : "gpt",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubs = variant === "subs";
  const accent = isSubs ? "#1DB954" : "#10a37f";

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const endpoint =
        siteSlug === "subs-store"
          ? "/api/payments/subs-store/pally/create"
          : "/api/payments/pally/create";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          planId,
          accountEmail,
          orderId,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        paymentUrl?: string;
        error?: string;
      };
      if (!res.ok || !body.paymentUrl) {
        setError(body.error ?? "Не удалось открыть оплату");
        return;
      }
      window.location.href = body.paymentUrl;
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handlePay()}
        disabled={loading}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto",
        )}
        style={{ backgroundColor: accent }}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
        Завершить оплату
      </button>
      {error ? (
        <p className={cn("text-xs", isSubs ? "text-red-300" : "text-red-600")}>{error}</p>
      ) : null}
    </div>
  );
}
