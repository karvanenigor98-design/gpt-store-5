import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { Metadata } from "next";
import { loadAdminOverviewStats, type AdminOverviewStats } from "@/lib/admin/revenue-stats";
import { loadSubsStoreDashboardBlock } from "@/lib/admin/subs-store-dashboard";
import { resolveAdminSiteSlug } from "@/lib/admin/siteFilter";
import { getSiteBySlug } from "@/lib/sites";
import { getSiteUUID } from "@/lib/admin/getSiteId";
import { countAuthUsersForAdminSite } from "@/lib/admin/gpt-auth-user-metrics";

export const metadata: Metadata = { title: "Admin · Главная" };

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const params = await searchParams;
  const siteSlug = resolveAdminSiteSlug(params);
  const site = getSiteBySlug(siteSlug);

  let overview: AdminOverviewStats;
  let totalOrders: number;
  let pendingOrders: number;
  let activeOrders: number;
  let openChats: number;
  let pendingReviews: number;
  let totalClients: number;
  let unreadClientMsgs: number;
  let revenueFootnote: string;

  if (siteSlug === "subs-store") {
    const subsAdmin = createSubsStoreAdminClient();
    if (!subsAdmin) {
      return (
        <div className="p-6">
          <h1 className="mb-2 font-heading text-2xl font-bold text-gray-900">Subs Store — данные</h1>
          <p className="max-w-xl text-sm text-gray-600">
            Чтобы видеть метрики Subs Store из этой панели, добавьте в окружение проекта{" "}
            <strong>GPT STORE</strong> переменные{" "}
            <code className="rounded bg-gray-100 px-1">SUBS_SUPABASE_URL</code> и{" "}
            <code className="rounded bg-gray-100 px-1">SUBS_SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            (отдельный проект Supabase Subs Store; ключ только серверный). См.{" "}
            <code className="rounded bg-gray-100 px-1">.env.example</code>.
          </p>
        </div>
      );
    }
    const m = await loadSubsStoreDashboardBlock(subsAdmin);
    overview = m.overview;
    totalOrders = m.totalOrders;
    pendingOrders = m.pendingOrders;
    activeOrders = m.activeOrders;
    openChats = m.openChats;
    pendingReviews = m.pendingReviews;
    totalClients = m.totalClients;
    unreadClientMsgs = m.unreadClientMsgs;
    revenueFootnote =
      "Выручка Subs Store: сумма final_price заказов с payment_status = paid. Учёт по дате создания заказа.";
  } else {
    const admin = createAdminClient();
    const siteId = await getSiteUUID(siteSlug);

    const ordersBaseQ = admin.from("orders").select("id", { count: "exact", head: true }).not("product", "ilike", "spotify%");

    const subsStoreId = await getSiteUUID("subs-store");

    let chatsBaseQ;
    if (subsStoreId) {
      chatsBaseQ = admin
        .from("chat_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .neq("site_id", subsStoreId);
    } else {
      chatsBaseQ = admin.from("chat_sessions").select("id", { count: "exact", head: true }).eq("status", "open");
    }

    let reviewsBaseQ;
    if (siteId) {
      reviewsBaseQ = admin
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("site_id", siteId);
    } else {
      reviewsBaseQ = admin.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending");
    }

    let unreadClientMsgsQ;
    if (siteId) {
      const { data: siteSessionIds } = await admin.from("chat_sessions").select("id").eq("site_id", siteId);
      const ids = (siteSessionIds ?? []).map((s) => s.id);
      if (ids.length > 0) {
        unreadClientMsgsQ = admin
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("sender_type", "client")
          .eq("is_read", false)
          .in("session_id", ids);
      } else {
        unreadClientMsgsQ = admin
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("id", "00000000-0000-0000-0000-000000000000");
      }
    } else if (subsStoreId) {
      const { data: excludeSessionIds } = await admin.from("chat_sessions").select("id").eq("site_id", subsStoreId);
      const excludeIds = (excludeSessionIds ?? []).map((s) => s.id);
      if (excludeIds.length > 0) {
        unreadClientMsgsQ = admin
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("sender_type", "client")
          .eq("is_read", false)
          .not("session_id", "in", `(${excludeIds.join(",")})`);
      } else {
        unreadClientMsgsQ = admin
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("sender_type", "client")
          .eq("is_read", false);
      }
    } else {
      unreadClientMsgsQ = admin
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("sender_type", "client")
        .eq("is_read", false);
    }

    const [
      ov,
      totalOrdersResp,
      pendingOrdersResp,
      activeOrdersResp,
      openChatsResp,
      pendingReviewsResp,
      totalClientsCount,
      unreadClientMsgsResp,
    ] = await Promise.all([
      loadAdminOverviewStats(admin, new Date(), siteSlug),
      ordersBaseQ,
      admin.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending").not("product", "ilike", "spotify%"),
      admin.from("orders").select("id", { count: "exact", head: true }).eq("status", "active").not("product", "ilike", "spotify%"),
      chatsBaseQ,
      reviewsBaseQ,
      countAuthUsersForAdminSite(admin, "gpt-store"),
      unreadClientMsgsQ,
    ]);

    overview = ov;
    totalOrders = totalOrdersResp.count ?? 0;
    pendingOrders = pendingOrdersResp.count ?? 0;
    activeOrders = activeOrdersResp.count ?? 0;
    openChats = openChatsResp.count ?? 0;
    pendingReviews = pendingReviewsResp.count ?? 0;
    totalClients = totalClientsCount;
    unreadClientMsgs = unreadClientMsgsResp.count ?? 0;
    revenueFootnote =
      "Выручка суммирует заказы со статусами оплата получена и далее по цепочке активации. Учёт по дате создания заказа в базе; точный учёт — у платёжного провайдера.";
  }

  const stat = (label: string, value: string | number, color: string) => (
    <div key={label} className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
      <p className={`font-heading text-lg font-bold sm:text-2xl md:text-3xl ${color}`}>{value}</p>
      <p className="mt-1 text-[10px] text-gray-400 sm:text-xs">{label}</p>
    </div>
  );

  const revenueAccent = siteSlug === "subs-store" ? "text-[#1DB954]" : "text-[#10a37f]";

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-2xl font-bold text-gray-900">
        Панель администратора
        <span className="ml-3 text-base font-normal" style={{ color: site.primaryColor }}>
          {site.brandName}
        </span>
      </h1>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Сегодня</h2>
      <div className="mb-8 grid grid-cols-3 gap-2 sm:gap-4 md:grid-cols-3">
        {stat("Заказов сегодня", overview.ordersToday, "text-gray-900")}
        {stat("Выручка сегодня", `${overview.revenueToday.toLocaleString("ru")} ₽`, revenueAccent)}
        {stat("Новые клиенты", overview.newClientsToday, "text-blue-600")}
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Выручка (оплаченные заказы)</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stat("Сегодня", `${overview.revenueToday.toLocaleString("ru")} ₽`, "text-emerald-600")}
        {stat("7 дней", `${overview.revenue7d.toLocaleString("ru")} ₽`, "text-emerald-600")}
        {stat("Месяц", `${overview.revenueMonth.toLocaleString("ru")} ₽`, "text-emerald-600")}
        {stat("Всё время", `${overview.revenueAll.toLocaleString("ru")} ₽`, "text-emerald-700")}
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">В работе</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {stat(
          siteSlug === "subs-store" ? "Зарегистрировано (Subs Auth)" : "Зарегистрировано (GPT Auth)",
          totalClients,
          "text-gray-900",
        )}
        {stat("Заказов всего", totalOrders, "text-gray-900")}
        {stat("Ожидают оплаты", pendingOrders, "text-amber-500")}
        {stat("Активных подписок", activeOrders, revenueAccent)}
        {stat("Открытые чаты", openChats, "text-blue-500")}
        {stat("Непрочитано от клиентов", unreadClientMsgs, "text-orange-500")}
        {stat("Отзывы на модерации", pendingReviews, "text-purple-500")}
      </div>

      <p className="mt-6 text-xs text-gray-500">{revenueFootnote}</p>
    </div>
  );
}
