"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  SUBS_ORDER_STATUS_LABELS,
  SUBS_ORDER_STATUSES,
} from "@/lib/admin/subs-order-status-labels";

const SUBS_STATUSES = SUBS_ORDER_STATUSES;

export type SubsOrderStatus = (typeof SUBS_STATUSES)[number];

type Props = {
  orderId: string;
  initialStatus: string;
  siteSlug: "subs-store";
};

export function SubsOrderStatusSelect({ orderId, initialStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onChange(next: string) {
    if (next === status) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}?site=subs-store`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Ошибка");
        return;
      }
      setStatus(next);
      router.refresh();
    } catch {
      setErr("Сеть");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={status}
        disabled={busy}
        onChange={(e) => void onChange(e.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-800"
      >
        {SUBS_STATUSES.map((s) => (
          <option key={s} value={s}>
            {SUBS_ORDER_STATUS_LABELS[s] ?? s}
          </option>
        ))}
      </select>
      {err && <span className="text-[10px] text-red-500">{err}</span>}
    </div>
  );
}
