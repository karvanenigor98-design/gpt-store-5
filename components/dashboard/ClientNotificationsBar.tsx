"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, MessageCircle, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import {
  buildClientNotificationHref,
  isClientChatNotification,
} from "@/lib/dashboard/client-notification-navigation";

type Item = {
  id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
};

const API_BY_SITE: Record<SiteSlug, string> = {
  "gpt-store": "/api/gpt/notifications",
  "subs-store": "/api/subs/notifications",
};

export function ClientNotificationsBar({ siteSlug }: { siteSlug: SiteSlug }) {
  const isSubs = siteSlug === "subs-store";
  const accent = isSubs ? "#1DB954" : "#10a37f";

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(API_BY_SITE[siteSlug], { credentials: "include" });
      const j = (await res.json().catch(() => ({}))) as { items?: Item[] };
      if (res.ok) setItems(j.items ?? []);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [siteSlug]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const displayItems = useMemo(
    () => [...items].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [items],
  );

  const unread = items.filter((i) => !i.is_read).length;

  async function markRead(id: string) {
    await fetch(API_BY_SITE[siteSlug], {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, is_read: true } : x)));
  }

  async function markAll() {
    await fetch(API_BY_SITE[siteSlug], {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark_all: true }),
    });
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
  }

  function onOpenItem(item: Item) {
    if (!item.is_read) void markRead(item.id);
    setOpen(false);
  }

  const triggerClass = isSubs
    ? "relative inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-gray-100 transition-colors hover:bg-white/10"
    : "relative inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100";

  const panelClass = isSubs
    ? "absolute right-0 top-full z-50 mt-1 w-[min(100vw-2rem,400px)] rounded-xl border border-white/10 bg-[#141414] shadow-xl"
    : "absolute right-0 top-full z-50 mt-1 w-[min(100vw-2rem,400px)] rounded-xl border border-gray-200 bg-white shadow-xl";

  return (
    <div ref={dropdownRef} className="relative flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell size={16} style={{ color: unread > 0 ? accent : undefined }} className={unread > 0 ? "" : "text-gray-500"} />
        Уведомления
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className={panelClass}>
          <div
            className={cn(
              "flex items-center justify-between border-b px-3 py-2",
              isSubs ? "border-white/10" : "border-gray-100",
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-semibold", isSubs ? "text-gray-400" : "text-gray-500")}>
                Уведомления
              </span>
              {unread > 0 && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ backgroundColor: `${accent}20`, color: accent }}
                >
                  {unread} новых
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                type="button"
                className="text-xs hover:underline"
                style={{ color: accent }}
                onClick={() => void markAll()}
              >
                Прочитать всё
              </button>
            )}
          </div>

          <ul className="max-h-80 overflow-y-auto">
            {loading && displayItems.length === 0 && (
              <li className={cn("px-3 py-6 text-center text-sm", isSubs ? "text-gray-500" : "text-gray-400")}>
                Загрузка…
              </li>
            )}
            {!loading && displayItems.length === 0 && (
              <li className={cn("px-3 py-6 text-center text-sm", isSubs ? "text-gray-500" : "text-gray-400")}>
                Пока тихо
              </li>
            )}
            {displayItems.map((item) => {
              const unreadItem = !item.is_read;
              const isChat = isClientChatNotification(item);
              return (
                <li key={item.id} className={cn("border-b last:border-0", isSubs ? "border-white/5" : "border-gray-50")}>
                  <Link
                    href={buildClientNotificationHref(siteSlug, item)}
                    onClick={() => onOpenItem(item)}
                    className={cn(
                      "block border-l-4 px-3 py-2.5 text-left transition-colors",
                      unreadItem
                        ? isSubs
                          ? "border-l-[#1DB954] bg-[#1DB954]/10 hover:bg-[#1DB954]/14"
                          : "border-l-[#10a37f] bg-[#10a37f]/10 hover:bg-gray-50"
                        : "border-l-transparent opacity-70 hover:bg-gray-50/80",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          "flex items-center gap-1.5 text-xs font-semibold",
                          unreadItem ? (isSubs ? "text-white" : "text-gray-900") : "text-gray-500",
                        )}
                      >
                        {isChat ? (
                          <MessageCircle size={12} style={{ color: accent }} />
                        ) : (
                          <Package size={12} style={{ color: accent }} />
                        )}
                        {item.title}
                      </p>
                      {unreadItem && (
                        <span
                          className="rounded px-1 py-0.5 text-[9px] font-bold uppercase text-white"
                          style={{ backgroundColor: accent }}
                        >
                          new
                        </span>
                      )}
                    </div>
                    {item.message ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{item.message}</p>
                    ) : null}
                    <p className="mt-1 text-[10px] text-gray-400">
                      {new Date(item.created_at).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
