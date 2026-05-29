"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

type SiteSlug = "gpt-store" | "subs-store";

type Item = {
  id: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
};

const API_BY_SITE: Record<SiteSlug, string> = {
  "gpt-store": "/api/gpt/notifications",
  "subs-store": "/api/subs/notifications",
};

export function LandingOrderStatusChip({ siteSlug }: { siteSlug: SiteSlug }) {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(API_BY_SITE[siteSlug], { credentials: "include" });
        const body = (await res.json().catch(() => ({}))) as { items?: Item[] };
        if (!cancelled && res.ok) {
          setItems(Array.isArray(body.items) ? body.items : []);
        }
      } catch {
        if (!cancelled) setItems([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [siteSlug]);

  const latestOrder = useMemo(() => {
    return [...items]
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .find((x) => x.entity_type === "order" && x.entity_id);
  }, [items]);

  if (!latestOrder?.entity_id) return null;

  const unread = items.filter((x) => !x.is_read).length;
  const href = `/dashboard/order/${encodeURIComponent(latestOrder.entity_id)}?site=${siteSlug}`;
  const accent = siteSlug === "subs-store" ? "#1DB954" : "#10a37f";
  const dark = siteSlug === "subs-store";

  return (
    <Link
      href={href}
      className={`relative inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
        dark
          ? "border-white/15 bg-white/5 text-white hover:bg-white/10"
          : "border-black/[0.1] bg-white text-gray-700 hover:bg-gray-50"
      }`}
      title="Открыть актуальный статус заказа"
    >
      <Bell size={13} style={{ color: unread > 0 ? accent : undefined }} />
      Статус заказа
      {unread > 0 ? (
        <span
          className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
          style={{ backgroundColor: "#ef4444" }}
        >
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
