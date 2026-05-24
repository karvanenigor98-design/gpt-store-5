import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { Metadata } from "next";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { SubsOrderStatusSelect } from "@/components/admin/SubsOrderStatusSelect";
import type { OrderStatus } from "@/types/database";
import { resolveAdminSiteSlug } from "@/lib/admin/siteFilter";
import { applySubsOrdersStatusFilter } from "@/lib/admin/subs-orders-query";
import { subsOrderStatusLabelRu } from "@/lib/admin/subs-order-status-labels";
import { getSiteBySlug } from "@/lib/sites";
import { HighlightScroll } from "@/components/ui/HighlightScroll";
import { UnpaidOrdersEmailCampaign } from "@/components/admin/UnpaidOrdersEmailCampaign";

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

    let q = subs
      .from("orders")
      .select(
        "id,status,payment_status,final_price,customer_email,created_at,user_id,tariffs(title),profiles(email,full_name)"
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    q = applySubsOrdersStatusFilter(q, filterStatus);

    const { data: rawOrders } = await q;

    type SubsOrderRow = {
      id: string;
      status: string;
      payment_status: string;
      final_price: number;
      customer_email: string;
      created_at: string;
      user_id: string | null;
      tariffs: { title: string } | { title: string }[] | null;
      profiles: { email: string | null; full_name: string | null } | null;
    };

    const orders = (rawOrders ?? []) as unknown as SubsOrderRow[];

    return (
      <div className="p-6">
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
                const tr = order.tariffs;
                const tariffTitle =
                  Array.isArray(tr) && tr[0]?.title ? tr[0].title
                  : tr && typeof tr === "object" && "title" in tr ? String((tr as { title: string }).title)
                  : "—";
                const prof = order.profiles;
                const email = prof?.email ?? order.customer_email ?? "—";
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
                      {prof?.full_name && <span className="block text-gray-500">{prof.full_name}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">{tariffTitle}</td>
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
    profiles: { email: string | null; telegram_username: string | null } | null;
  };

  let query = supabase
    .from("orders")
    .select("id, product, plan_id, price, status, account_email, created_at, profiles(email, telegram_username)")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  query = query.not("product", "ilike", "spotify%");

  if (filterStatus === "awaiting_payment") {
    query = query.eq("status", "pending");
  } else if (filterStatus) {
    query = query.eq("status", filterStatus as OrderStatus);
  }

  const { data: rawOrders } = await query;
  const orders = (rawOrders ?? []) as unknown as OrderRow[];

  return (
    <div className="p-6">
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
              const profile = order.profiles;
              return (
                <tr key={order.id} id={`row-${order.id}`} className="scroll-mt-4 text-sm text-gray-700 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <code className="text-[11px] text-gray-500">{order.id.split("-")[0]}…</code>
                    <p className="text-xs text-gray-400">{order.account_email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {profile?.email ?? "—"}
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
