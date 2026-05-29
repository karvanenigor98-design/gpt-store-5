import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { Metadata } from "next";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { SubsOrderStatusSelect } from "@/components/admin/SubsOrderStatusSelect";
import type { OrderStatus } from "@/types/database";
import { resolveAdminSiteSlug } from "@/lib/admin/siteFilter";
import { staffOrdersStatusHref } from "@/lib/admin/staffNavHref";
import { fetchGptOrdersForAdmin } from "@/lib/admin/gpt-orders-fetch";
import { resolveGptOrderPlanLabel } from "@/lib/admin/gpt-order-plan-label";
import { fetchSubsOrdersForAdmin } from "@/lib/admin/subs-orders-fetch";
import { subsOrderStatusLabelRu } from "@/lib/admin/subs-order-status-labels";
import { getSiteBySlug } from "@/lib/sites";
import { HighlightScroll } from "@/components/ui/HighlightScroll";
import { UnpaidOrdersEmailCampaign } from "@/components/admin/UnpaidOrdersEmailCampaign";
import { MarkOrdersSeenOnVisit } from "@/components/admin/MarkOrdersSeenOnVisit";
import { AdminOrdersLiveRefresh } from "@/components/admin/AdminOrdersLiveRefresh";

export const metadata: Metadata = { title: "Admin · Заказы" };

const GPT_STATUS_CLASSES: Record<string, string> = {
  pending: "bg-[#1DB954]/18 text-[#0a6b38] border-[#1DB954]/50 shadow-sm",
  paid: "bg-emerald-50 text-emerald-800 border-emerald-300",
  activating: "bg-sky-50 text-sky-800 border-sky-300",
  waiting_client: "bg-amber-50 text-amber-900 border-amber-300",
  active: "bg-[#1DB954]/25 text-[#0a6b38] border-[#1DB954]/55 font-bold",
  failed: "bg-red-50 text-red-800 border-red-300",
  expired: "bg-gray-100 text-gray-600 border-gray-300",
  refunded: "bg-gray-100 text-gray-600 border-gray-300",
};

const SUBS_STATUS_CLASSES: Record<string, string> = {
  new: "bg-[#1DB954]/18 text-[#0a6b38] border-[#1DB954]/50 shadow-sm",
  awaiting_payment: "bg-[#1DB954]/18 text-[#0a6b38] border-[#1DB954]/50 shadow-sm",
  pending_payment_setup: "bg-[#1DB954]/12 text-[#0d8f4a] border-[#1DB954]/40",
  paid: "bg-emerald-50 text-emerald-800 border-emerald-300",
  processing: "bg-sky-50 text-sky-800 border-sky-300",
  activated: "bg-[#1DB954]/25 text-[#0a6b38] border-[#1DB954]/55 font-bold",
  problem: "bg-red-50 text-red-800 border-red-300",
};

const GPT_STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает оплаты",
  paid: "Оплачен",
  activating: "В активации",
  waiting_client: "Ждем клиента",
  active: "Активен",
  failed: "Ошибка",
  expired: "Истек",
  refunded: "Возврат",
};

const SUBS_PAY_LABELS: Record<string, string> = {
  pending: "Ожидает оплаты",
  paid: "Оплачено",
  failed: "Ошибка",
  refunded: "Возврат",
  manual_review: "Проверка",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; site?: string; highlight?: string }>;
}) {
  const { status: filterStatus, page: pageParam, site: siteParam } = await searchParams;
  const siteSlug = resolveAdminSiteSlug({ site: siteParam });
  const site = getSiteBySlug(siteSlug);
  const page = Number(pageParam ?? 1);
  const limit = 100;
  const offset = (page - 1) * limit;

  if (siteSlug === "subs-store") {
    const subs = createSubsStoreAdminClient();
    if (!subs) {
      return (
        <div className="p-6">
          <h1 className="font-heading text-2xl font-bold text-gray-900">Заказы · {site.brandName}</h1>
          <p className="mt-2 max-w-xl text-sm text-gray-600">
            Подключите <code className="rounded bg-gray-100 px-1">SUBS_SUPABASE_URL</code> и{" "}
            <code className="rounded bg-gray-100 px-1">SUBS_SUPABASE_SERVICE_ROLE_KEY</code> в проекте GPT STORE.
          </p>
        </div>
      );
    }

    const { orders, error: ordersError } = await fetchSubsOrdersForAdmin(subs, {
      filterStatus,
      offset,
      limit,
    });

    return (
      <div className="p-6">
        <AdminOrdersLiveRefresh siteSlug="subs-store" />
        <MarkOrdersSeenOnVisit site="subs-store" />
        <HighlightScroll accent="subs" />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-bold text-gray-900">
            Заказы
            <span className="ml-3 text-base font-normal" style={{ color: site.primaryColor }}>
              {site.brandName}
            </span>
          </h1>
          <div className="flex flex-wrap gap-2">
            {["", "new", "awaiting_payment", "paid", "processing", "activated", "problem"].map((s) => (
              <a
                key={s || "all"}
                href={staffOrdersStatusHref(siteSlug, s || undefined)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterStatus === s || (!filterStatus && !s)
                    ? "bg-[#1DB954]/15 text-[#0d8f4a]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {s ? subsOrderStatusLabelRu(s) : "Все"}
              </a>
            ))}
          </div>
        </div>

        {filterStatus === "awaiting_payment" && (
          <UnpaidOrdersEmailCampaign siteSlug="subs-store" />
        )}

        {ordersError && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {ordersError}
          </p>
        )}

        {!ordersError && orders.length === 0 && (
          <p className="mb-4 text-sm text-gray-500">Заказов по выбранному фильтру нет.</p>
        )}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-widest text-gray-500">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Клиент</th>
                <th className="px-4 py-3">Тариф</th>
                <th className="px-4 py-3">Сумма</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3 min-w-[160px]">Изменить</th>
                <th className="px-4 py-3">Оплата</th>
                <th className="px-4 py-3">Дата</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => {
                const email = order.profileEmail ?? order.customer_email ?? "—";
                return (
                  <tr
                    key={order.id}
                    id={`row-${order.id}`}
                    className="scroll-mt-4 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <code className="text-[11px] text-gray-500">{order.id.slice(0, 8)}…</code>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {email}
                      {order.profileName && (
                        <span className="block text-gray-500">{order.profileName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">{order.tariffTitle}</td>
                    <td className="px-4 py-3 text-xs font-semibold">{Number(order.final_price ?? 0).toLocaleString("ru")} ₽</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          SUBS_STATUS_CLASSES[order.status] ??
                          "border-gray-200 bg-gray-50 text-gray-700"
                        }`}
                      >
                        {subsOrderStatusLabelRu(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <SubsOrderStatusSelect orderId={order.id} initialStatus={order.status} siteSlug="subs-store" />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {SUBS_PAY_LABELS[order.payment_status] ?? order.payment_status}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(order.created_at).toLocaleDateString("ru")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const supabase = createAdminClient();

  const { orders, error: gptOrdersError } = await fetchGptOrdersForAdmin(supabase, {
    filterStatus,
    offset,
    limit,
  });

  const userIds = [...new Set(orders.map((o) => o.user_id).filter((id): id is string => Boolean(id)))];
  const profileByUserId = new Map<string, { email: string | null; telegram_username: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, telegram_username")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      if (p.id) {
        profileByUserId.set(p.id, {
          email: p.email,
          telegram_username: p.telegram_username,
        });
      }
    }
  }

  return (
    <div className="p-6">
      <AdminOrdersLiveRefresh siteSlug="gpt-store" />
      <MarkOrdersSeenOnVisit site="gpt-store" />
      <HighlightScroll accent="gpt" />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-gray-900">
          Заказы
          <span className="ml-3 text-base font-normal" style={{ color: site.primaryColor }}>
            {site.brandName}
          </span>
        </h1>
        <div className="flex gap-2">
          {["", "awaiting_payment", "activating", "waiting_client", "active", "failed"].map((s) => (
            <a
              key={s || "all"}
              href={staffOrdersStatusHref(siteSlug, s || undefined)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filterStatus === s || (!filterStatus && !s)
                  ? "bg-[#10a37f]/10 text-[#0f7d62]"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {s ? (s === "awaiting_payment" ? "Ожидает оплаты" : GPT_STATUS_LABELS[s]) : "Все"}
            </a>
          ))}
        </div>
      </div>

      {filterStatus === "awaiting_payment" && (
        <UnpaidOrdersEmailCampaign siteSlug="gpt-store" />
      )}

      {gptOrdersError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {gptOrdersError}
        </p>
      )}

      {!gptOrdersError && orders.length === 0 && (
        <p className="mb-4 text-sm text-gray-500">Заказов по выбранному фильтру нет.</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-widest text-gray-500">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Клиент</th>
              <th className="px-4 py-3">Тариф</th>
              <th className="px-4 py-3">Сумма</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3 min-w-[148px]">Изменить</th>
              <th className="px-4 py-3">Дата</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((order) => {
              const profile = order.user_id ? profileByUserId.get(order.user_id) : undefined;
              const clientEmail =
                profile?.email?.trim() ||
                order.account_email?.trim() ||
                "—";
              return (
                <tr key={order.id} id={`row-${order.id}`} className="scroll-mt-4 text-sm text-gray-700 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <code className="text-[11px] text-gray-500">{order.id.split("-")[0]}…</code>
                    <p className="text-xs text-gray-400">{order.account_email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {clientEmail}
                    {profile?.telegram_username && (
                      <span className="block text-gray-500">@{profile.telegram_username}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs">{resolveGptOrderPlanLabel(order)}</span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">{order.price.toLocaleString("ru")} ₽</td>
                    <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${GPT_STATUS_CLASSES[order.status] ?? GPT_STATUS_CLASSES.pending}`}
                    >
                      {GPT_STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <OrderStatusSelect orderId={order.id} initialStatus={order.status as OrderStatus} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(order.created_at).toLocaleDateString("ru")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
