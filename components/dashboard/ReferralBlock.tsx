"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Gift, Link2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReferralMePayload } from "@/lib/referrals/types";

type Props = {
  siteSlug: "gpt-store" | "subs-store";
  primaryColor?: string;
};

export function ReferralBlock({ siteSlug, primaryColor = "#10a37f" }: Props) {
  const [data, setData] = useState<ReferralMePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isSpotify = siteSlug === "subs-store";

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch(`/api/referral/me?site=${siteSlug}`, { credentials: "same-origin" });
      const json = (await res.json()) as ReferralMePayload & { error?: string };
      if (!res.ok) {
        setErr(json.error ?? "Не удалось загрузить");
        return;
      }
      setData(json);
    } catch {
      setErr("Ошибка сети");
    }
  }, [siteSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyLink() {
    if (!data?.referralLink) return;
    try {
      await navigator.clipboard.writeText(data.referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("Не удалось скопировать");
    }
  }

  if (err && !data) {
    return (
      <div
        className={cn(
          "rounded-2xl border p-5 text-sm",
          isSpotify ? "border-white/10 bg-[#161616] text-gray-400" : "border-black/[0.07] bg-white text-gray-500",
        )}
      >
        Реферальная программа временно недоступна. Примените миграцию 012_referrals в Supabase.
      </div>
    );
  }

  if (!data) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        isSpotify ? "border-white/10 bg-[#161616]" : "border-black/[0.07] bg-white shadow-sm",
      )}
    >
      <div className="mb-4 flex items-center gap-2">
        <Gift size={16} style={{ color: primaryColor }} />
        <h3 className={cn("text-sm font-semibold", isSpotify ? "text-gray-200" : "text-gray-800")}>
          Пригласи друга — получите промокоды
        </h3>
      </div>

      <p className={cn("mb-4 text-xs leading-relaxed", isSpotify ? "text-gray-500" : "text-gray-500")}>
        Друг переходит по вашей ссылке и оформляет первый заказ — вы получаете промокод на следующий заказ, друг —
        на первый.
      </p>

      <div
        className={cn(
          "mb-3 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5",
          isSpotify ? "border-white/10 bg-white/[0.04]" : "border-gray-100 bg-gray-50",
        )}
      >
        <Link2 size={14} className="shrink-0 opacity-50" />
        <code className={cn("min-w-0 flex-1 truncate text-xs", isSpotify ? "text-gray-300" : "text-gray-700")}>
          {data.referralLink}
        </code>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white"
          style={{ background: primaryColor }}
        >
          <Copy size={12} />
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>

      <div className="mb-3 flex items-center gap-2 text-xs">
        <Users size={13} className="opacity-50" />
        <span className={isSpotify ? "text-gray-400" : "text-gray-500"}>
          Приглашено друзей: <strong className={isSpotify ? "text-white" : "text-gray-900"}>{data.referredCount}</strong>
        </span>
        <span className={isSpotify ? "text-gray-600" : "text-gray-300"}>·</span>
        <span className={isSpotify ? "text-gray-500" : "text-gray-500"}>
          Ваш код: <strong className="font-mono">{data.referralCode}</strong>
        </span>
      </div>

      {data.pendingRewards.length > 0 && (
        <ul className="space-y-2">
          {data.pendingRewards.map((r) => (
            <li
              key={`${r.role}-${r.code}`}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs",
                isSpotify ? "bg-[#1DB954]/10 text-[#86efac]" : "bg-emerald-50 text-emerald-800",
              )}
            >
              <span>
                {r.role === "referee" ? "Промокод на первый заказ" : "Промокод за приглашение"}
              </span>
              <code className="font-bold">{r.code}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
