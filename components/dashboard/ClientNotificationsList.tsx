"use client";

import Link from "next/link";
import { MessageCircle, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildClientNotificationHref,
  isClientChatNotification,
} from "@/lib/dashboard/client-notification-navigation";
import type { ClientNotificationItem } from "@/hooks/useClientNotifications";
import type { SiteSlug } from "@/lib/auth/siteUiSession";

type Props = {
  siteSlug: SiteSlug;
  isSubs: boolean;
  accent: string;
  items: ClientNotificationItem[];
  loading: boolean;
  loadError: string | null;
  onMarkRead: (id: string) => void;
  compact?: boolean;
};

export function ClientNotificationsList({
  siteSlug,
  isSubs,
  accent,
  items,
  loading,
  loadError,
  onMarkRead,
  compact = false,
}: Props) {
  return (
    <ul className={cn("overflow-y-auto", compact ? "max-h-80" : "max-h-none")}>
      {loading && items.length === 0 && (
        <li className={cn("px-3 py-6 text-center text-sm", isSubs ? "text-gray-500" : "text-gray-400")}>
          Загрузка…
        </li>
      )}
      {loadError && (
        <li className={cn("px-3 py-4 text-center text-sm", isSubs ? "text-amber-400" : "text-amber-700")}>
          {loadError}
        </li>
      )}
      {!loadError && !loading && items.length === 0 && (
        <li className={cn("px-3 py-6 text-center text-sm", isSubs ? "text-gray-500" : "text-gray-400")}>
          Пока тихо
        </li>
      )}
      {items.map((item) => {
        const unreadItem = !item.is_read;
        const isChat = isClientChatNotification(item);
        return (
          <li key={item.id} className={cn("border-b last:border-0", isSubs ? "border-white/5" : "border-gray-50")}>
            <Link
              href={buildClientNotificationHref(siteSlug, item)}
              onClick={() => {
                if (!item.is_read) onMarkRead(item.id);
              }}
              className={cn(
                "block border-l-4 px-3 py-2.5 text-left transition-colors",
                unreadItem
                  ? isSubs
                    ? "border-l-[#1DB954] bg-[#1DB954]/10 hover:bg-[#1DB954]/14"
                    : "border-l-[#10a37f] bg-[#10a37f]/10 hover:bg-gray-50"
                  : "border-l-transparent opacity-70 hover:bg-gray-50/80",
                !compact && "md:px-4 md:py-3",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-semibold md:text-sm",
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
                {new Date(item.created_at).toLocaleString("ru-RU", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
