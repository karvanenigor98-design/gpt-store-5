"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientNotificationsContext } from "./ClientNotificationsContext";
import { ClientNotificationsList } from "./ClientNotificationsList";

type Variant = "dropdown" | "icon";

export function ClientNotificationsBar({ variant = "dropdown" }: { variant?: Variant }) {
  const { siteSlug, isSubs, accent, items, unread, loading, loadError, markRead, markAllRead } =
    useClientNotificationsContext();

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const siteQuery = `?site=${siteSlug}`;
  const notificationsHref = `/dashboard/notifications${siteQuery}`;

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const badge = unread > 0 && (
    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
      {unread > 9 ? "9+" : unread}
    </span>
  );

  if (variant === "icon") {
    return (
      <Link
        href={notificationsHref}
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
          isSubs
            ? "border-white/15 bg-white/5 text-gray-100 hover:bg-white/10"
            : "border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100",
        )}
        aria-label={unread > 0 ? `Уведомления, ${unread} новых` : "Уведомления"}
      >
        <Bell size={18} style={{ color: unread > 0 ? accent : undefined }} />
        {badge}
      </Link>
    );
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
        <span className="hidden sm:inline">Уведомления</span>
        {badge}
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
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  type="button"
                  className="text-xs hover:underline"
                  style={{ color: accent }}
                  onClick={() => void markAllRead()}
                >
                  Прочитать всё
                </button>
              )}
              <Link
                href={notificationsHref}
                className="text-xs text-gray-500 hover:underline md:hidden"
                onClick={() => setOpen(false)}
              >
                Все
              </Link>
            </div>
          </div>

          <ClientNotificationsList
            siteSlug={siteSlug}
            isSubs={isSubs}
            accent={accent}
            items={items}
            loading={loading}
            loadError={loadError}
            onMarkRead={(id) => {
              void markRead(id);
              setOpen(false);
            }}
            compact
          />
        </div>
      )}
    </div>
  );
}
