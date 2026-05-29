"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@/types/database";
import { GPT_ORDER_STATUSES, GPT_ORDER_STATUS_LABELS } from "@/lib/admin/gpt-order-status-labels";

const OPTIONS: { value: OrderStatus; label: string }[] = GPT_ORDER_STATUSES.map((value) => ({
  value,
  label: GPT_ORDER_STATUS_LABELS[value],
}));

type Props = {
  orderId: string;
  initialStatus: OrderStatus;
};

export function OrderStatusSelect({ orderId, initialStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onChange(next: OrderStatus) {
    if (next === status) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}?site=gpt-store`, {
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
        onChange={(e) => void onChange(e.target.value as OrderStatus)}
        className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-800"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {err && <span className="text-[10px] text-red-500">{err}</span>}
    </div>
  );
}
