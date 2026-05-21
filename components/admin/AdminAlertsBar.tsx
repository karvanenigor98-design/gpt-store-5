"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StaffPanelRoot } from "@/lib/admin/notificationNavigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Volume2, VolumeX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  buildAdminNotificationHref,
  persistAdminSiteBeforeNavigate,
  siteSlugFromAlertSiteId,
  staffPanelRootFromPathname,
} from "@/lib/admin/notificationNavigation";
import { refreshStaffNavBadges } from "@/lib/admin/staff-nav-badges-client";
import { loadNotificationSoundEnabled, playNotificationPing } from "@/lib/admin/notification-sound";
import { SiteSwitcher, getAdminSelectedSiteSlug } from "./SiteSwitcher";
import { getSiteBySlug } from "@/lib/sites";
import { staffNotificationsHref } from "@/lib/admin/staffNavHref";

type AlertItem = {
  id: string;
  title: string;
  body: string;
  href: string;
  at: number;
  siteId?: string;
  /** UUID строки в Subs/GPT notifications — для mark read в БД */
  dbNotificationId?: string;
  readInDb?: boolean;
};

const READ_KEY = "gptstore-admin-alert-read-ids";
const SOUND_KEY = "gptstore-admin-sound-enabled";

function loadRead(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveRead(ids: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-200)));
  } catch {}
}

function loadSoundEnabled(): boolean {
  return loadNotificationSoundEnabled();
}

function saveSoundEnabled(v: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, String(v));
  } catch {}
}

function playPing() {
  playNotificationPing();
}

export function AdminAlertsBar() {
  const pathname = usePathname();
  const staffRoot = staffPanelRootFromPathname(pathname);
  const isOperatorPanel = staffRoot === "/operator";
  const staffRootRef = useRef<StaffPanelRoot>(staffRoot);
  staffRootRef.current = staffRoot;
  const [open, setOpen] = useState(false);

  function staffHref(href: string): string {
    if (staffRoot === "/operator" && href.startsWith("/admin")) {
      return href.replace(/^\/admin/, "/operator");
    }
    return href;
  }
  const [allItems, setAllItems] = useState<AlertItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentSiteSlug, setCurrentSiteSlug] = useState<string>("gpt-store");
  const supabase = useMemo(() => createClient(), []);
  const bootRef = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReadIds(loadRead());
    setSoundEnabled(loadSoundEnabled());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromUrl = new URLSearchParams(window.location.search).get("site");
    if (fromUrl === "gpt-store" || fromUrl === "subs-store") {
      setCurrentSiteSlug(fromUrl);
      return;
    }
    setCurrentSiteSlug(getAdminSelectedSiteSlug());
  }, [pathname]);

  function resolveSiteSlugFromItemSiteId(siteId: string | undefined): string | null {
    if (!siteId) return null;
    const bySlug = getSiteBySlug(siteId);
    if (bySlug.slug === siteId) return bySlug.slug;
    // Backward-compatible fallback for UUID / missing mapping:
    // keep alert visible instead of hiding it due unknown site_id format.
    return null;
  }

  // Close on click outside — but do NOT mark as read
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const pushAlert = useCallback(
    (item: AlertItem, sound: boolean) => {
      setAllItems((prev) => {
        const next = [item, ...prev.filter((x) => x.id !== item.id)].slice(0, 60);
        return next;
      });
      if (sound && soundEnabled) {
        const r = loadRead();
        if (!r.has(item.id)) playPing();
      }
    },
    [soundEnabled]
  );

  const subsSeenNotifRef = useRef<Set<string>>(new Set());
  const subsNotifBootRef = useRef(false);
  const gptSeenNotifRef = useRef<Set<string>>(new Set());
  const gptNotifBootRef = useRef(false);

  useEffect(() => {
    if (currentSiteSlug !== "gpt-store") return;

    let cancelled = false;

    async function pollGptNotifications() {
      try {
        const res = await fetch("/api/admin/notifications?site=gpt-store", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          items?: {
            id: string;
            title: string;
            message: string;
            is_read?: boolean;
            created_at?: string;
            entity_type?: string | null;
            entity_id?: string | null;
            type?: string;
          }[];
        };
        const items = data.items ?? [];
        const isBoot = !gptNotifBootRef.current;
        for (const row of items) {
          const href = buildAdminNotificationHref(
            {
              siteSlug: "gpt-store",
              entity_type: row.entity_type,
              entity_id: row.entity_id,
              type: row.type,
            },
            staffRootRef.current,
          );
          const alertId = `gpt-notif-${row.id}`;
          const isNew = !gptSeenNotifRef.current.has(row.id);
          gptSeenNotifRef.current.add(row.id);

          setAllItems((prev) => {
            const existing = prev.find((x) => x.id === alertId);
            const nextItem: AlertItem = {
              id: alertId,
              title: row.title || "GPT STORE",
              body: (row.message ?? "").slice(0, 120),
              href,
              at: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
              siteId: "gpt-store",
              dbNotificationId: row.id,
              readInDb: Boolean(row.is_read),
            };
            if (existing) {
              return prev.map((x) => (x.id === alertId ? { ...x, ...nextItem } : x));
            }
            return [nextItem, ...prev].slice(0, 60);
          });

          if (!isBoot && isNew && !row.is_read) {
            refreshStaffNavBadges();
            if (soundEnabled) playPing();
          }
        }
        gptNotifBootRef.current = true;
      } catch {
        /* noop */
      }
    }

    void pollGptNotifications();
    const t = window.setInterval(() => void pollGptNotifications(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [currentSiteSlug, soundEnabled, staffRoot]);

  useEffect(() => {
    if (currentSiteSlug !== "subs-store") return;

    let cancelled = false;

    async function pollSubsNotifications() {
      try {
        const res = await fetch("/api/admin/subs-store/notifications", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          items?: {
            id: string;
            title: string;
            message: string;
            is_read?: boolean;
            created_at?: string;
            entity_type?: string | null;
            entity_id?: string | null;
            type?: string;
          }[];
        };
        const items = data.items ?? [];
        const isBoot = !subsNotifBootRef.current;
        for (const row of items) {
          const href = buildAdminNotificationHref(
            {
              siteSlug: "subs-store",
              entity_type: row.entity_type,
              entity_id: row.entity_id,
              type: row.type,
            },
            staffRootRef.current,
          );
          const alertId = `subs-notif-${row.id}`;
          const isNew = !subsSeenNotifRef.current.has(row.id);
          subsSeenNotifRef.current.add(row.id);

          setAllItems((prev) => {
            const existing = prev.find((x) => x.id === alertId);
            const nextItem: AlertItem = {
              id: alertId,
              title: row.title || "Subs Store",
              body: (row.message ?? "").slice(0, 120),
              href,
              at: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
              siteId: "subs-store",
              dbNotificationId: row.id,
              readInDb: Boolean(row.is_read),
            };
            if (existing) {
              return prev.map((x) => (x.id === alertId ? { ...x, ...nextItem } : x));
            }
            return [nextItem, ...prev].slice(0, 60);
          });

          if (!isBoot && isNew && !row.is_read) {
            refreshStaffNavBadges();
            if (soundEnabled) playPing();
          }
        }
        subsNotifBootRef.current = true;
      } catch {
        /* noop */
      }
    }

    void pollSubsNotifications();
    const t = window.setInterval(() => void pollSubsNotifications(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [currentSiteSlug, pushAlert, staffRoot]);

  useEffect(() => {
    if (bootRef.current) return;
    if (currentSiteSlug === "subs-store") return;
    bootRef.current = true;
    const root = staffRootRef.current;

    const ch = supabase
      .channel("admin-alerts-v2")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        const row = payload.new as {
          id?: string;
          plan_id?: string;
          price?: number;
          product?: string;
          site_id?: string;
        };
        if (!row?.id) return;
        const siteId = row.site_id ?? (row.product?.startsWith("spotify") ? "subs-store" : "gpt-store");
        const orderSite = siteSlugFromAlertSiteId(siteId);
        pushAlert(
          {
            id: `order-ins-${row.id}`,
            title: "🔔 Новый заказ",
            body: `${row.plan_id ?? "тариф"} · ${row.price ?? "?"} ₽`,
            href: buildAdminNotificationHref(
              {
                siteSlug: orderSite,
                entity_type: "order",
                entity_id: row.id,
                type: "new_order",
              },
              root,
            ),
            at: Date.now(),
            siteId,
          },
          true
        );
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        const row = payload.new as { id?: string; status?: string; product?: string; site_id?: string };
        const old = payload.old as { status?: string };
        if (!row?.id || row.status === old?.status) return;
        const siteId = row.site_id ?? (row.product?.startsWith("spotify") ? "subs-store" : "gpt-store");
        const orderSite = siteSlugFromAlertSiteId(siteId);
        if (row.status === "activating" || row.status === "paid") {
          pushAlert(
            {
              id: `order-paid-${row.id}-${row.status}`,
              title: "✅ Оплата пришла",
              body: `Заказ ${row.id.slice(0, 8)}…`,
              href: buildAdminNotificationHref(
                {
                  siteSlug: orderSite,
                  entity_type: "order",
                  entity_id: row.id,
                  type: "payment_success",
                },
                root,
              ),
              at: Date.now(),
              siteId,
            },
            true
          );
        }
        if (row.status === "failed") {
          pushAlert(
            {
              id: `order-failed-${row.id}`,
              title: "⚠️ Ошибка оплаты",
              body: `Заказ ${row.id.slice(0, 8)}…`,
              href: buildAdminNotificationHref(
                {
                  siteSlug: orderSite,
                  entity_type: "order",
                  entity_id: row.id,
                  type: "payment_failed",
                },
                root,
              ),
              at: Date.now(),
              siteId,
            },
            true
          );
        }
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const row = payload.new as {
            id?: string;
            sender_type?: string;
            content?: string;
            session_id?: string;
          };
          if (!row?.id || row.sender_type !== "client") return;
          refreshStaffNavBadges();
          const preview = (row.content ?? "").slice(0, 80);
          pushAlert(
            {
              id: `msg-${row.id}`,
              title: "💬 Клиент написал",
              body: preview || "Новое сообщение",
              href: buildAdminNotificationHref(
                {
                  siteSlug: "gpt-store",
                  entity_type: "chat_session",
                  entity_id: row.session_id ?? null,
                  type: "new_chat_message",
                },
                root,
              ),
              at: Date.now(),
              siteId: "gpt-store",
            },
            true
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reviews" },
        (payload) => {
          const row = payload.new as { id?: string; author_name?: string; site_id?: string };
          if (!row?.id) return;
          const reviewSite = siteSlugFromAlertSiteId(row.site_id ?? undefined);
          pushAlert(
            {
              id: `review-${row.id}`,
              title: "⭐ Новый отзыв",
              body: `От ${row.author_name ?? "пользователя"} — требует модерации`,
              href: buildAdminNotificationHref(
                {
                  siteSlug: reviewSite,
                  entity_type: "review",
                  entity_id: row.id,
                  type: "new_review",
                },
                root,
              ),
              at: Date.now(),
              siteId: row.site_id ?? undefined,
            },
            false
          );
        }
      )
      .subscribe();

    const notifCh = supabase
      .channel("admin-alerts-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const row = payload.new as {
            id?: string;
            title?: string;
            message?: string;
            is_read?: boolean;
            created_at?: string;
            entity_type?: string | null;
            entity_id?: string | null;
          };
          if (!row?.id || row.is_read) return;
          refreshStaffNavBadges();
          const href = buildAdminNotificationHref(
            {
              siteSlug: "gpt-store",
              entity_type: row.entity_type,
              entity_id: row.entity_id,
              type: (row as { type?: string }).type ?? null,
            },
            root,
          );
          pushAlert(
            {
              id: `gpt-notif-${row.id}`,
              title: row.title ?? "Уведомление",
              body: (row.message ?? "").slice(0, 120),
              href,
              at: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
              siteId: "gpt-store",
              dbNotificationId: row.id,
              readInDb: false,
            },
            true,
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
      void supabase.removeChannel(notifCh);
    };
  }, [supabase, pushAlert, currentSiteSlug, staffRoot]);

  // Filter items by currently selected site
  const items = allItems.filter((item) => {
    const resolvedSlug = resolveSiteSlugFromItemSiteId(item.siteId);
    if (!resolvedSlug) return true;
    return resolvedSlug === currentSiteSlug;
  });

  function isAlertUnread(i: AlertItem): boolean {
    if (i.readInDb) return false;
    return !readIds.has(i.id);
  }

  const unread = items.filter(isAlertUnread).length;
  const totalUnread = allItems.filter(isAlertUnread).length;

  async function markDbRead(dbId: string) {
    if (currentSiteSlug === "subs-store") {
      await fetch("/api/admin/subs-store/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dbId }),
      });
      setAllItems((prev) =>
        prev.map((x) => (x.dbNotificationId === dbId ? { ...x, readInDb: true } : x)),
      );
      refreshStaffNavBadges();
    } else {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dbId, site: "gpt-store" }),
      });
      setAllItems((prev) =>
        prev.map((x) => (x.dbNotificationId === dbId ? { ...x, readInDb: true } : x)),
      );
      refreshStaffNavBadges();
    }
  }

  async function markAllRead() {
    const next = new Set(readIds);
    for (const i of items) next.add(i.id);
    setReadIds(next);
    saveRead(next);

    if (currentSiteSlug === "subs-store") {
      await fetch("/api/admin/subs-store/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all: true }),
      });
    } else {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all: true, site: "gpt-store" }),
      });
    }
    setAllItems((prev) => prev.map((x) => ({ ...x, readInDb: true })));
    refreshStaffNavBadges();
  }

  function onOpenItem(item: AlertItem) {
    const next = new Set(readIds);
    next.add(item.id);
    setReadIds(next);
    saveRead(next);
    if (item.dbNotificationId && !item.readInDb) {
      void markDbRead(item.dbNotificationId);
    } else {
      refreshStaffNavBadges();
    }
    const slug = siteSlugFromAlertSiteId(item.siteId ?? currentSiteSlug);
    persistAdminSiteBeforeNavigate(slug);
    setCurrentSiteSlug(slug);
    setOpen(false);
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    saveSoundEnabled(next);
  }

  return (
    <div className="relative border-b border-black/[0.06] bg-white/90 px-4 py-2 backdrop-blur-xl">
      <div className="mx-auto flex max-w-full items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SiteSwitcher
            onSiteChange={(s) => setCurrentSiteSlug(s.slug)}
            showManageLink={!isOperatorPanel}
          />
        </div>

        {/* Notifications bell — right side */}
        <div ref={dropdownRef} className="relative flex items-center gap-2">
          {/* Sound toggle */}
          <button
            type="button"
            onClick={toggleSound}
            title={soundEnabled ? "Выключить звук уведомлений" : "Включить звук уведомлений"}
            className="rounded-lg border border-gray-200 bg-gray-50 p-1.5 text-gray-500 hover:bg-gray-100 transition-colors"
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>

          {/* Bell button */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="relative inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-100 transition-colors"
          >
            <Bell size={16} className={unread > 0 ? "text-[#10a37f]" : "text-gray-500"} />
            Уведомления
            {totalUnread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {open && (
            <div className="absolute right-0 top-full z-50 mt-1 w-[min(100vw-2rem,400px)] rounded-xl border border-gray-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500">
                    Уведомления
                  </span>
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
                      onClick={markAllRead}
                    >
                      Прочитать всё
                    </button>
                  )}
                  <Link
                    href={staffNotificationsHref(
                      currentSiteSlug as "gpt-store" | "subs-store",
                      pathname?.startsWith("/operator") ? "/operator/notifications" : "/admin/notifications",
                    )}
                    className="text-xs text-gray-400 hover:text-gray-600"
                    onClick={() => setOpen(false)}
                  >
                    Все →
                  </Link>
                </div>
              </div>
              <ul className="max-h-80 overflow-y-auto">
                {items.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-gray-400">
                    Пока тихо — новые события появятся здесь
                  </li>
                )}
                {items.map((i) => {
                  const unreadItem = isAlertUnread(i);
                  return (
                  <li key={i.id} className="border-b border-gray-50 last:border-0">
                    <Link
                      href={staffHref(i.href)}
                      onClick={() => onOpenItem(i)}
                      className={cn(
                        "block border-l-4 px-3 py-2.5 text-left transition-colors hover:bg-gray-50",
                        unreadItem
                          ? currentSiteSlug === "subs-store"
                            ? "border-l-[#1DB954] bg-[#1DB954]/10"
                            : "border-l-[#10a37f] bg-[#10a37f]/10"
                          : "border-l-transparent bg-white opacity-70",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-xs font-semibold", unreadItem ? "text-gray-900" : "text-gray-500")}>
                          {i.title}
                        </p>
                        {unreadItem && (
                          <span className="rounded bg-[#10a37f] px-1 py-0.5 text-[9px] font-bold uppercase text-white">
                            new
                          </span>
                        )}
                      </div>
                      <p className={cn("mt-0.5 line-clamp-2 text-xs", unreadItem ? "text-gray-600" : "text-gray-400")}>
                        {i.body}
                      </p>
                      <p className="mt-1 text-[10px] text-gray-400">
                        {new Date(i.at).toLocaleTimeString("ru-RU", {
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
      </div>
    </div>
  );
}
