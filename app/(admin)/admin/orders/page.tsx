import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { Metadata } from "next";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { SubsOrderStatusSelect } from "@/components/admin/SubsOrderStatusSelect";
import type { OrderStatus } from "@/types/database";
import { resolveAdminSiteSlug } from "@/lib/admin/siteFilter";
import { fetchSubsOrdersForAdmin } from "@/lib/admin/subs-orders-fetch";
import { subsOrderStatusLabelRu } from "@/lib/admin/subs-order-status-labels";
import { getSiteBySlug } from "@/lib/sites";
import { HighlightScroll } from "@/components/ui/HighlightScroll";
import { UnpaidOrdersEmailCampaign } from "@/components/admin/UnpaidOrdersEmailCampaign";
import { MarkOrdersSeenOnVisit } from "@/components/admin/MarkOrdersSeenOnVisit";

export const metadata: Metadata = { title: "Admin · Заказы" };

const GPT_STATUS_CLASSES: Record<string, string> = {
  pending: "bg-amber-900/30 text-amber-400 border-amber-700/30",
  paid: "bg-emerald-900/30 text-emerald-400 border-emerald-700/30",
  activating: "bg-blue-900/30 text-blue-400 border-blue-700/30",
  waiting_client: "bg-orange-900/30 text-orange-400 border-orange-700/30",
  active: "bg-green-900/30 text-green-400 border-green-700/30",
  failed: "bg-red-900/30 text-red-400 border-red-700/30",
  expired: "bg-gray-800 text-gray-500 border-gray-700",
  refunded: "bg-gray-800 text-gray-500 border-gray-700",
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
  const limit = 25;
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
                href={s ? `/admin/orders?status=${s}&site=${siteSlug}` : `/admin/orders?site=${siteSlug}`}
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
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
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

  type OrderRow = {
    id: string;
    product: string;
    plan_id: string;
    price: number;
    status: OrderStatus;
    account_email: string | null;
    created_at: string;
    user_id: string | null;
  };

  let query = supabase
    .from("orders")
    .select("id, product, plan_id, price, status, account_email, created_at, user_id")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  query = query.not("product", "ilike", "spotify%");

  if (filterStatus === "awaiting_payment") {
    query = query.eq("status", "pending");
  } else if (filterStatus) {
    query = query.eq("status", filterStatus as OrderStatus);
  }

  const { data: rawOrders, error: gptOrdersError } = await query;
  const orders = (rawOrders ?? []) as OrderRow[];

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
              href={s ? `/admin/orders?status=${s}&site=${siteSlug}` : `/admin/orders?site=${siteSlug}`}
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
          {gptOrdersError.message}
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
              const clientEmail = profile?.email ?? order.account_email ?? "—";
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
                    <span className="text-xs">
                      {order.product === "chatgpt-plus" ? "Plus" : "Pro"} / {order.plan_id}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">{order.price.toLocaleString("ru")} ₽</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${GPT_STATUS_CLASSES[order.status] ?? GPT_STATUS_CLASSES.pending}`}
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
