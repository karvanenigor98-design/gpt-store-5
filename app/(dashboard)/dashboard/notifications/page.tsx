"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { ClientNotificationsList } from "@/components/dashboard/ClientNotificationsList";
import { useClientNotificationsContext } from "@/components/dashboard/ClientNotificationsContext";

function resolveSiteSlug(sp: URLSearchParams): SiteSlug {
  const raw = sp.get("site");
  return raw === "subs-store" ? "subs-store" : "gpt-store";
}

function ClientNotificationsPageContent() {
  const searchParams = useSearchParams();
  const siteSlug = resolveSiteSlug(searchParams);
  const { isSubs, accent, items, unread, loading, loadError, markRead, markAllRead } =
    useClientNotificationsContext();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell size={20} className={isSubs ? "text-gray-400" : "text-gray-500"} />
          <div>
            <h1 className={cn("text-lg font-bold md:text-xl", isSubs ? "text-white" : "text-gray-900")}>
              Уведомления
            </h1>
            {unread > 0 && (
              <p className={cn("text-sm", isSubs ? "text-gray-400" : "text-gray-500")}>
                {unread} непрочитанных
              </p>
            )}
          </div>
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors md:text-sm",
              isSubs
                ? "border-[#1DB954]/40 text-[#1DB954] hover:bg-[#1DB954]/10"
                : "border-[#10a37f]/30 text-[#10a37f] hover:bg-[#10a37f]/5",
            )}
          >
            <CheckCheck size={16} />
            Прочитать всё
          </button>
        )}
      </div>

      <div
        className={cn(
          "overflow-hidden rounded-xl border",
          isSubs ? "border-white/10 bg-[#141414]" : "border-gray-200 bg-white",
        )}
      >
        <ClientNotificationsList
          siteSlug={siteSlug}
          isSubs={isSubs}
          accent={accent}
          items={items}
          loading={loading}
          loadError={loadError}
          onMarkRead={(id) => void markRead(id)}
        />
      </div>

      <p className={cn("mt-4 text-center text-xs", isSubs ? "text-gray-500" : "text-gray-400")}>
        <Link href={`/dashboard${siteSlug === "subs-store" ? "?site=subs-store" : "?site=gpt-store"}`} className="hover:underline">
          На главную кабинета
        </Link>
      </p>
    </div>
  );
}

export default function ClientNotificationsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-gray-500">Загрузка уведомлений…</div>
      }
    >
      <ClientNotificationsPageContent />
    </Suspense>
  );
}
