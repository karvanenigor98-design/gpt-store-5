"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ChatRoomListItem } from "@/types/chat-ui";
import { Loader2, MessageCircle, ShoppingBag } from "lucide-react";

import { StaffOrderStatusSelect } from "@/components/admin/StaffOrderStatusSelect";
import { gptOrderStatusLabelRu } from "@/lib/admin/gpt-order-status-labels";
import { subsOrderStatusLabelRu } from "@/lib/admin/subs-order-status-labels";
import { staffNavHref } from "@/lib/admin/staffNavHref";
import { cn } from "@/lib/utils";

type OrderRow = {
  id: string;
  status: string;
  plan_id: string;
  price: number;
  created_at: string;
};

type Summary = {
  profile: {
    id: string;
    email: string | null;
    username: string | null;
    telegram_id: number | null;
    telegram_username: string | null;
    created_at: string;
    last_seen: string | null;
    notes: string | null;
    tags: string[];
    client_stage: string | null;
    role: string;
  } | null;
  site_slug?: "gpt-store" | "subs-store";
  effective_stage: string;
  has_active_subscription: boolean;
  focus_order: OrderRow | null;
  active_order: OrderRow | null;
  orders: OrderRow[];
  hint?: string;
};

const STAGE_LABEL: Record<string, string> = {
  purchased: "Купил",
  waiting: "В ожидании",
  no_purchase: "Не покупал",
  needs_help: "Нужна помощь",
  other: "Другое",
};

interface Props {
  room: ChatRoomListItem | null;
  staffBasePath: string;
  siteSlug?: "gpt-store" | "subs-store";
  /** Заказ из URL (?order_id=) — подсветить в карточке. */
  highlightOrderId?: string | null;
}

function statusLabel(siteSlug: "gpt-store" | "subs-store", status: string): string {
  return siteSlug === "subs-store" ? subsOrderStatusLabelRu(status) : gptOrderStatusLabelRu(status);
}

export function ClientContextSidebar({
  room,
  staffBasePath,
  siteSlug = "gpt-store",
  highlightOrderId = null,
}: Props) {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!room?.client_id) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void (async () => {
      try {
        const orderFromClient = room.client_id.startsWith("order:")
          ? room.client_id.slice("order:".length)
          : "";
        const isSyntheticClient =
          room.client_id.startsWith("email:") || room.client_id.startsWith("order:");
        const params = new URLSearchParams({
          email: room.client?.email ?? "",
          sessionId: room.id ?? "",
          site: siteSlug,
        });
        if (!isSyntheticClient) params.set("userId", room.client_id);
        const orderId = highlightOrderId || orderFromClient;
        if (orderId) params.set("orderId", orderId);
        const res = await fetch(`/api/staff/client-summary?${params.toString()}`, {
          credentials: "include",
        });
        const json = (await res.json()) as Summary & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Не удалось загрузить");
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setErr(e instanceof Error ? e.message : "Ошибка");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [room?.client_id, room?.client?.email, room?.id, siteSlug, highlightOrderId]);

  const resolvedSite = data?.site_slug ?? siteSlug;
  const focusOrder = data?.focus_order ?? data?.active_order ?? null;
  const ordersHref = staffNavHref(`${staffBasePath}/orders`, resolvedSite);

  if (!room) {
    return (
      <div className="hidden w-72 flex-shrink-0 border-l border-gray-100 bg-gray-50/80 p-4 text-sm text-gray-500 xl:block">
        Выберите клиента
      </div>
    );
  }

  return (
    <aside className="hidden w-80 flex-shrink-0 flex-col border-l border-gray-100 bg-gray-50/90 xl:flex">
      <div className="border-b border-gray-100 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Карточка клиента</p>
        <p className="mt-1 truncate text-sm font-semibold text-gray-900">
          {room.client?.full_name ?? room.client?.email ?? "Клиент"}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
        {loading && (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка…
          </div>
        )}
        {err && <p className="text-red-600">{err}</p>}
        {!loading && !err && data && (
          <div className="space-y-4">
            {data.profile ? (
              <>
                <div>
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="break-all text-gray-900">{data.profile.email ?? room.client?.email ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Имя</p>
                  <p className="text-gray-900">{data.profile.username ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Telegram</p>
                  <p className="text-gray-900">
                    {data.profile.telegram_username ? `@${data.profile.telegram_username}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Этап</p>
                  <p className="font-medium text-gray-900">
                    {STAGE_LABEL[data.effective_stage] ?? data.effective_stage}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Подписка</p>
                  <p className="text-gray-900">
                    {data.has_active_subscription ? "Есть активная" : "Нет активной"}
                  </p>
                </div>
                {focusOrder ? (
                  <div
                    className={cn(
                      "rounded-xl border bg-white p-3",
                      highlightOrderId && focusOrder.id === highlightOrderId
                        ? "border-[#10a37f] ring-2 ring-[#10a37f]/25"
                        : "border-gray-200",
                    )}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Текущий заказ
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {focusOrder.plan_id} · {focusOrder.price.toLocaleString("ru")} ₽
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {statusLabel(resolvedSite, focusOrder.status)}
                    </p>
                    <div className="mt-3">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        Сменить статус
                      </p>
                      <StaffOrderStatusSelect
                        orderId={focusOrder.id}
                        initialStatus={focusOrder.status}
                        siteSlug={resolvedSite}
                      />
                    </div>
                    <Link
                      href={`${staffNavHref(`${staffBasePath}/orders`, resolvedSite)}&highlight=${encodeURIComponent(focusOrder.id)}`}
                      className="mt-3 inline-flex items-center rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Открыть заказ
                    </Link>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs text-gray-400">Заказов всего</p>
                  <p className="text-gray-900">{data.orders.length}</p>
                </div>
                {data.profile.notes ? (
                  <div>
                    <p className="text-xs text-gray-400">Заметка</p>
                    <p className="whitespace-pre-wrap text-gray-700">{data.profile.notes}</p>
                  </div>
                ) : null}
              </>
            ) : null}
            <Link
              href={ordersHref}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <ShoppingBag size={14} />
              Все заказы клиента
            </Link>
            <Link
              href={`${staffBasePath.replace(/\/$/, "")}/clients?highlight=${encodeURIComponent(room.client_id)}`}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <MessageCircle size={14} />
              Полная карточка
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
