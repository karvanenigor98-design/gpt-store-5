"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

type Props = {
  orderId: string;
  /** Show full UUID always (order detail). Default: compact truncated. */
  full?: boolean;
};

function truncateOrderId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function OrderIdCell({ orderId, full = false }: Props) {
  const [copied, setCopied] = useState(false);
  const display = full ? orderId : truncateOrderId(orderId);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      toast.success("ID скопирован");
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Не удалось скопировать ID");
    }
  };

  return (
    <div className="flex max-w-[11rem] items-center gap-1.5 sm:max-w-[13rem]">
      <code
        className="truncate text-[11px] text-gray-500"
        title={orderId}
        aria-label={`ID заказа ${orderId}`}
      >
        {display}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        title="Скопировать ID"
        aria-label="Скопировать полный ID"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
