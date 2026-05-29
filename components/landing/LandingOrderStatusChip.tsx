"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

type SiteSlug = "gpt-store" | "subs-store";

export function LandingOrderStatusChip({ siteSlug }: { siteSlug: SiteSlug }) {
  const [href, setHref] = useState(() =>
    siteSlug === "subs-store" ? "/dashboard/orders?site=subs-store" : "/dashboard/orders?site=gpt-store",
  );
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const navRes = await fetch(`/api/customer/order-status-nav?site=${siteSlug}`, {
          credentials: "include",
        });
        const navBody = (await navRes.json().catch(() => ({}))) as { href?: string };
        if (!cancelled && navRes.ok && typeof navBody.href === "string") {
          setHref(navBody.href);
        }

        const notifApi =
          siteSlug === "subs-store" ? "/api/subs/notifications" : "/api/gpt/notifications";
        const notifRes = await fetch(notifApi, { credentials: "include" });
        const notifBody = (await notifRes.json().catch(() => ({}))) as {
          items?: { is_read: boolean }[];
        };
        if (!cancelled && notifRes.ok && Array.isArray(notifBody.items)) {
          setUnread(notifBody.items.filter((x) => !x.is_read).length);
        }
      } catch {
        /* keep defaults */
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [siteSlug]);

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
      title="Статус заказа"
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
