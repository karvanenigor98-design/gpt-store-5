"use client";

import { useEffect, useState } from "react";
import { PanelErrorBoundary } from "@/components/errors/PanelErrorBoundary";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bell, CheckCheck, Filter } from "lucide-react";
import {
  persistAdminSiteBeforeNavigate,
  siteSlugFromAlertSiteId,
  staffPanelRootFromPathname,
  type AdminNotificationSiteSlug,
} from "@/lib/admin/notificationNavigation";
import { loadNotificationSoundEnabled } from "@/lib/admin/notification-sound";
import { getAdminSelectedSiteSlug } from "@/components/admin/SiteSwitcher";
import { useStaffNotifications } from "@/hooks/useStaffNotifications";
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

function NotificationsPageContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const staffRoot = staffPanelRootFromPathname(pathname);
  const siteSlug = resolveSiteSlug(searchParams);

  const [filter, setFilter] = useState<FilterType>("all");
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    setSoundEnabled(loadNotificationSoundEnabled());
  }, []);

  const { items, unread: unreadCount, loading, loadError, markRead, markAllRead } =
    useStaffNotifications({
      siteSlug,
      staffRoot,
      soundEnabled,
      soundVolume: 10,
    });

  const filteredItems = items.filter((i) => {
    if (filter === "unread") return !i.is_read;
    if (filter !== "all") return i.type === filter;
    return true;
  });

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
            onClick={() => void markAllRead()}
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
          <div className="rounded-2xl border border-amber-200 bg-amber-50 py-8 text-center text-sm text-amber-900">
            {loadError}
          </div>
        )}
        {loading && <div className="py-12 text-center text-sm text-gray-400">Загрузка...</div>}
        {!loadError && !loading && filteredItems.length === 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white py-12 text-center">
            <Bell size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">Уведомлений нет</p>
            <p className="mt-1 text-xs text-gray-400">Они появятся здесь, когда придут</p>
          </div>
        )}
        {filteredItems.map((item) => (
            <Link
              key={`${item.site_id ?? "gpt-store"}:${item.id}`}
              href={item.href}
              className={notificationCardClass(item.is_read, siteSlug)}
              onClick={() => {
                const eventSite = siteSlugFromAlertSiteId(item.site_id ?? null);
                persistAdminSiteBeforeNavigate(eventSite);
                if (!item.is_read) void markRead(item.id, eventSite);
              }}
            >
              <div className="mt-0.5 flex-shrink-0 text-lg">{TYPE_ICONS[item.type ?? ""] ?? "🔔"}</div>
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
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      item.site_id === "subs-store"
                        ? "bg-[#1DB954]/15 text-[#0d8f4a]"
                        : "bg-[#10a37f]/10 text-[#0f7d62]",
                    )}
                  >
                    {item.site_id === "subs-store" ? "SPOTIFY STORE" : "GPT STORE"}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                    {TYPE_LABELS[item.type ?? ""] ?? item.type}
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
        ))}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <PanelErrorBoundary
      title="Не удалось открыть раздел уведомлений"
      className="m-6 rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-800"
    >
      <NotificationsPageContent />
    </PanelErrorBoundary>
  );
}
