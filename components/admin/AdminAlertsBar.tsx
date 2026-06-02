"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  persistAdminSiteBeforeNavigate,
  staffPanelRootFromPathname,
} from "@/lib/admin/notificationNavigation";
import {
  loadNotificationSoundEnabled,
  loadNotificationVolume,
  NOTIFICATION_VOLUME_MAX,
  NOTIFICATION_VOLUME_MIN,
  playNotificationPing,
  saveNotificationSoundEnabled,
  saveNotificationVolume,
} from "@/lib/admin/notification-sound";
import { useStaffNotifications } from "@/hooks/useStaffNotifications";
import { SiteSwitcher, getAdminSelectedSiteSlug } from "./SiteSwitcher";
import { staffNotificationsHref } from "@/lib/admin/staffNavHref";

export function AdminAlertsBar() {
  const pathname = usePathname();
  const staffRoot = staffPanelRootFromPathname(pathname);
  const isOperatorPanel = staffRoot === "/operator";
  const [open, setOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(10);
  const [currentSiteSlug, setCurrentSiteSlug] = useState<"gpt-store" | "subs-store">("gpt-store");
  function staffHref(href: string): string {
    if (staffRoot === "/operator" && href.startsWith("/admin")) {
      return href.replace(/^\/admin/, "/operator");
    }
    return href;
  }

  const { items, unread, loadError, markRead, markAllRead } = useStaffNotifications({
    siteSlug: currentSiteSlug,
    staffRoot,
    soundEnabled,
    soundVolume,
  });

  useEffect(() => {
    setSoundEnabled(loadNotificationSoundEnabled());
    setSoundVolume(loadNotificationVolume());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromUrl = new URLSearchParams(window.location.search).get("site");
    if (fromUrl === "gpt-store" || fromUrl === "subs-store") {
      setCurrentSiteSlug(fromUrl);
      return;
    }
    const selected = getAdminSelectedSiteSlug();
    setCurrentSiteSlug(selected === "subs-store" ? "subs-store" : "gpt-store");
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const el = document.getElementById("admin-alerts-dropdown-root");
      if (el && !el.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    saveNotificationSoundEnabled(next);
    if (next) playNotificationPing({ volume: soundVolume });
  }

  function onVolumeChange(level: number) {
    setSoundVolume(level);
    saveNotificationVolume(level);
  }

  function previewSound() {
    playNotificationPing({ volume: soundVolume });
  }

  function onOpenItem(id: string, href: string, siteId?: string | null) {
    const eventSite = siteId === "subs-store" ? "subs-store" : "gpt-store";
    void markRead(id, eventSite);
    const siteFromHref = (() => {
      try {
        const u = new URL(href, window.location.origin);
        const s = u.searchParams.get("site");
        return s === "subs-store" ? "subs-store" : "gpt-store";
      } catch {
        return eventSite;
      }
    })();
    persistAdminSiteBeforeNavigate(siteFromHref);
    setOpen(false);
    window.location.href = staffHref(href);
  }

  return (
    <div className="relative border-b border-black/[0.06] bg-white/90 px-4 py-2 backdrop-blur-xl">
      <div className="mx-auto flex max-w-full items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SiteSwitcher
            onSiteChange={(s) => setCurrentSiteSlug(s.slug === "subs-store" ? "subs-store" : "gpt-store")}
            showManageLink={!isOperatorPanel}
          />
        </div>

        <div id="admin-alerts-dropdown-root" className="relative flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1">
            <button
              type="button"
              onClick={toggleSound}
              title={soundEnabled ? "Выключить звук" : "Включить звук"}
              className="rounded p-0.5 text-gray-500 transition-colors hover:bg-gray-100"
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
            {soundEnabled && (
              <>
                <label className="sr-only" htmlFor="admin-notification-volume">
                  Громкость уведомлений
                </label>
                <input
                  id="admin-notification-volume"
                  type="range"
                  min={NOTIFICATION_VOLUME_MIN}
                  max={NOTIFICATION_VOLUME_MAX}
                  step={1}
                  value={soundVolume}
                  onChange={(e) => onVolumeChange(Number(e.target.value))}
                  onMouseUp={previewSound}
                  onTouchEnd={previewSound}
                  className="h-1.5 w-20 cursor-pointer accent-[#10a37f]"
                  title={`Громкость: ${soundVolume} из ${NOTIFICATION_VOLUME_MAX}`}
                />
                <span className="min-w-[1.25rem] text-center text-[10px] font-semibold tabular-nums text-gray-600">
                  {soundVolume}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="relative inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
          >
            <Bell size={16} className={unread > 0 ? "text-[#10a37f]" : "text-gray-500"} />
            Уведомления
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-full z-50 mt-1 w-[min(100vw-2rem,400px)] rounded-xl border border-gray-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500">Уведомления</span>
                  {unread > 0 && (
                    <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                      {unread} новых
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {unread > 0 && (
                    <button
                      type="button"
                      className="text-xs text-[#10a37f] hover:underline"
                      onClick={() => void markAllRead()}
                    >
                      Прочитать всё
                    </button>
                  )}
                  <Link
                    href={staffNotificationsHref(
                      currentSiteSlug,
                      pathname?.startsWith("/operator")
                        ? "/operator/notifications"
                        : "/admin/notifications",
                    )}
                    className="text-xs text-gray-400 hover:text-gray-600"
                    onClick={() => setOpen(false)}
                  >
                    Все →
                  </Link>
                </div>
              </div>
              <ul className="max-h-80 overflow-y-auto">
                {loadError && (
                  <li className="px-3 py-4 text-center text-sm text-amber-700">{loadError}</li>
                )}
                {!loadError && items.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-gray-400">
                    Пока тихо — новые события появятся здесь
                  </li>
                )}
                {items.map((i) => {
                  const unreadItem = !i.is_read;
                  return (
                    <li key={`${i.site_id ?? "gpt-store"}:${i.id}`} className="border-b border-gray-50 last:border-0">
                      <button
                        type="button"
                        onClick={() => onOpenItem(i.id, i.href, i.site_id)}
                        className={cn(
                          "block w-full border-l-4 px-3 py-2.5 text-left transition-colors hover:bg-gray-50",
                          unreadItem
                            ? currentSiteSlug === "subs-store"
                              ? "border-l-[#1DB954] bg-[#1DB954]/10"
                              : "border-l-[#10a37f] bg-[#10a37f]/10"
                            : "border-l-transparent bg-white opacity-70",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "text-xs font-semibold",
                              unreadItem ? "text-gray-900" : "text-gray-500",
                            )}
                          >
                            {i.title}
                          </p>
                          {unreadItem && (
                            <span className="rounded bg-[#10a37f] px-1 py-0.5 text-[9px] font-bold uppercase text-white">
                              new
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                              i.site_id === "subs-store"
                                ? "bg-[#1DB954]/15 text-[#0d8f4a]"
                                : "bg-[#10a37f]/10 text-[#0f7d62]",
                            )}
                          >
                            {i.site_id === "subs-store" ? "SPOTIFY STORE" : "GPT STORE"}
                          </span>
                        </div>
                        <p
                          className={cn(
                            "mt-0.5 line-clamp-2 text-xs",
                            unreadItem ? "text-gray-600" : "text-gray-400",
                          )}
                        >
                          {(i.message ?? "").slice(0, 120)}
                        </p>
                        <p className="mt-1 text-[10px] text-gray-400">
                          {new Date(i.created_at).toLocaleTimeString("ru-RU", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
