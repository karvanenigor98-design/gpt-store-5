"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bell, CheckCheck, Filter } from "lucide-react";
import {
  buildAdminNotificationHref,
  persistAdminSiteBeforeNavigate,
  staffPanelRootFromPathname,
  type AdminNotificationSiteSlug,
} from "@/lib/admin/notificationNavigation";
import { refreshStaffNavBadges } from "@/lib/admin/staff-nav-badges-client";
import { loadNotificationSoundEnabled, playNotificationPing } from "@/lib/admin/notification-sound";
import { getAdminSelectedSiteSlug } from "@/components/admin/SiteSwitcher";
import {
  notificationCardClass,
  notificationTitleClass,
  notificationUnreadBadge,
} from "@/components/admin/notification-styles";
import { cn } from "@/lib/utils";
import type { NotificationType } from "@/types/database";

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
  site_id?: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  new_order: "Новый заказ",
  payment_success: "Успешная оплата",
  payment_failed: "Ошибка оплаты",
  new_chat_message: "Сообщение клиента",
  chat_reply: "Ответ поддержки",
  new_review: "Новый отзыв",
  order_needs_data: "Нужны данные",
  order_problem: "Проблема с заказом",
  order_activated: "Заказ активирован",
  subscription_expiring: "Подписка истекает",
};

const TYPE_ICONS: Record<string, string> = {
  new_order: "🔔",
  payment_success: "✅",
  payment_failed: "⚠️",
  new_chat_message: "💬",
  chat_reply: "✉️",
  new_review: "⭐",
  order_needs_data: "📋",
  order_problem: "🚨",
  order_activated: "🎉",
  subscription_expiring: "⏰",
};

type FilterType = "all" | "unread" | NotificationType;

function resolveSiteSlug(sp: URLSearchParams): AdminNotificationSiteSlug {
  const raw = sp.get("site");
  if (raw === "subs-store" || raw === "gpt-store") return raw;
  if (typeof window !== "undefined") {
    const saved = getAdminSelectedSiteSlug();
    if (saved === "subs-store" || saved === "gpt-store") return saved;
  }
  return "gpt-store";
}

export default function NotificationsPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const staffRoot = staffPanelRootFromPathname(pathname);
  const siteSlug = resolveSiteSlug(searchParams);

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const seenIdsRef = useRef<Set<string>>(new Set());
  const bootRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const apiUrl =
      siteSlug === "subs-store"
        ? "/api/admin/subs-store/notifications"
        : `/api/admin/notifications?site=${siteSlug}`;

    async function load() {
      setLoadError(null);
      try {
        const r = await fetch(apiUrl, { credentials: "include" });
        let j = {} as { items?: NotificationItem[]; error?: string };
        try {
          j = (await r.json()) as { items?: NotificationItem[]; error?: string };
        } catch {
          if (!r.ok && !cancelled) setLoadError("Некорректный ответ сервера");
          return;
        }
        if (!r.ok) {
          if (!cancelled) {
            setLoadError(j.error ?? `Ошибка ${r.status}`);
            setItems([]);
          }
          return;
        }

        const list = (j.items ?? []) as NotificationItem[];
        if (cancelled) return;

        const isBoot = !bootRef.current;
        let hasNewUnread = false;
        if (!isBoot) {
          for (const row of list) {
            if (!row.is_read && !seenIdsRef.current.has(row.id)) {
              hasNewUnread = true;
              if (loadNotificationSoundEnabled()) {
                playNotificationPing();
                break;
              }
            }
          }
        }
        for (const row of list) seenIdsRef.current.add(row.id);
        bootRef.current = true;

        setItems(list);
        if (hasNewUnread) refreshStaffNavBadges();
      } catch {
        if (!cancelled) {
          setLoadError("Не удалось загрузить уведомления");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    bootRef.current = false;
    seenIdsRef.current = new Set();
    void load();
    const intv = window.setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(intv);
    };
  }, [siteSlug]);

  const filteredItems = items.filter((i) => {
    if (filter === "unread") return !i.is_read;
    if (filter !== "all") return i.type === filter;
    return true;
  });

  async function markRead(id: string) {
    if (siteSlug === "subs-store") {
      const r = await fetch("/api/admin/subs-store/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (r.ok) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_read: true } : i)));
        refreshStaffNavBadges();
      }
      return;
    }
    const r = await fetch("/api/admin/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, site: siteSlug }),
    });
    if (r.ok) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_read: true } : i)));
      refreshStaffNavBadges();
    }
  }

  async function markAllRead() {
    if (siteSlug === "subs-store") {
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
        body: JSON.stringify({ mark_all: true, site: siteSlug }),
      });
    }
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
    refreshStaffNavBadges();
  }

  const unreadCount = items.filter((i) => !i.is_read).length;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell size={20} className="text-gray-500" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Уведомления</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-500">{unreadCount} непрочитанных</p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="flex items-center gap-2 rounded-lg border border-[#10a37f]/30 px-4 py-2 text-sm font-medium text-[#10a37f] hover:bg-[#10a37f]/5 transition-colors"
          >
            <CheckCheck size={16} />
            Прочитать всё
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { value: "all", label: "Все" },
          { value: "unread", label: "Непрочитанные" },
          { value: "new_order", label: "Заказы" },
          { value: "payment_success", label: "Оплата" },
          { value: "new_chat_message", label: "Чат" },
          { value: "new_review", label: "Отзывы" },
        ].map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value as FilterType)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.value
                ? "bg-[#10a37f] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200",
            )}
          >
            <Filter size={10} />
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loadError && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {loadError}
          </p>
        )}
        {loading && <div className="py-12 text-center text-sm text-gray-400">Загрузка...</div>}
        {!loading && filteredItems.length === 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white py-12 text-center">
            <Bell size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">Уведомлений нет</p>
            <p className="mt-1 text-xs text-gray-400">Они появятся здесь, когда придут</p>
          </div>
        )}
        {filteredItems.map((item) => {
          const href = buildAdminNotificationHref(
            {
              siteSlug,
              entity_type: item.entity_type,
              entity_id: item.entity_id,
              type: item.type,
            },
            staffRoot,
          );
          return (
            <Link
              key={item.id}
              href={href}
              className={notificationCardClass(item.is_read, siteSlug)}
              onClick={() => {
                persistAdminSiteBeforeNavigate(siteSlug);
                if (!item.is_read) void markRead(item.id);
              }}
            >
              <div className="mt-0.5 flex-shrink-0 text-lg">{TYPE_ICONS[item.type] ?? "🔔"}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className={notificationTitleClass(item.is_read)}>{item.title}</p>
                  {!item.is_read && (
                    <span className={notificationUnreadBadge(siteSlug)}>Новое</span>
                  )}
                </div>
                <p className={cn("mt-0.5 text-sm", item.is_read ? "text-gray-400" : "text-gray-600")}>
                  {item.message}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                    {TYPE_LABELS[item.type] ?? item.type}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {new Date(item.created_at).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
