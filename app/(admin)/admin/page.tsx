import Link from "next/link";
import { headers } from "next/headers";
import { tryCreateAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { Metadata } from "next";
import { loadAdminOverviewStats, type AdminOverviewStats } from "@/lib/admin/revenue-stats";
import { loadSubsStoreDashboardBlock } from "@/lib/admin/subs-store-dashboard";
import { resolveAdminSiteSlug } from "@/lib/admin/siteFilter";
import { staffPanelRootFromPathname } from "@/lib/admin/notificationNavigation";
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
  const headersList = await headers();
  const pathname = headersList.get("x-invoke-pathname") ?? headersList.get("x-pathname") ?? "";
  const staffRoot = staffPanelRootFromPathname(pathname);
  const isOperatorPanel = staffRoot === "/operator";
  const reviewsHref = `${staffRoot}/reviews?status=pending&site=${siteSlug}`;

  let overview: AdminOverviewStats;
  let totalOrders: number;
  let pendingOrders: number;
  let activeOrders: number;
  let openChats: number;
  let pendingReviews: number;
  let totalClients: number;
  let unreadClientMsgs: number;
  let revenueFootnote: string;
  let statsLoadFailed = false;

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
    const admin = tryCreateAdminClient();
    if (!admin) {
      return (
        <div className="p-6">
          <h1 className="mb-2 font-heading text-2xl font-bold text-gray-900">Панель администратора</h1>
          <p className="max-w-xl text-sm text-gray-600">
            На сервере не настроен{" "}
            <code className="rounded bg-gray-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code>. Добавьте ключ в
            окружение Vercel и перезапустите деплой.
          </p>
        </div>
      );
    }
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

    try {
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
    } catch (err) {
      console.error("[admin/page] stats load failed", err);
      statsLoadFailed = true;
      overview = {
        todayYmd: "",
        revenueToday: 0,
        revenue7d: 0,
        revenueMonth: 0,
        revenueAll: 0,
        ordersToday: 0,
        newClientsToday: 0,
      };
      totalOrders = 0;
      pendingOrders = 0;
      activeOrders = 0;
      openChats = 0;
      pendingReviews = 0;
      totalClients = 0;
      unreadClientMsgs = 0;
    }
    revenueFootnote =
      "Выручка суммирует заказы со статусами оплата получена и далее по цепочке активации. Учёт по дате создания заказа в базе; точный учёт — у платёжного провайдера.";
  }

  const stat = (
    label: string,
    value: string | number,
    color: string,
    href?: string,
  ) => {
    const inner = (
      <>
        <p className={`font-heading text-2xl font-bold md:text-3xl ${color}`}>{value}</p>
        <p className="mt-1 text-xs text-gray-400">{label}</p>
      </>
    );
    if (!href) {
      return (
        <div key={label} className="rounded-xl border border-gray-200 bg-white p-4">
          {inner}
        </div>
      );
    }
    return (
      <Link
        key={label}
        href={href}
        className="rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-purple-300 hover:bg-purple-50/40"
      >
        {inner}
      </Link>
    );
  };

  const revenueAccent = siteSlug === "subs-store" ? "text-[#1DB954]" : "text-[#10a37f]";

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-2xl font-bold text-gray-900">
        {isOperatorPanel ? "Панель оператора" : "Панель администратора"}
        <span className="ml-3 text-base font-normal" style={{ color: site.primaryColor }}>
          {site.brandName}
        </span>
      </h1>

      {statsLoadFailed ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Не удалось загрузить часть метрик. Проверьте{" "}
          <code className="rounded bg-white px-1">SUPABASE_SERVICE_ROLE_KEY</code> на Vercel (~219 символов JWT) и
          перезапустите деплой.
        </div>
      ) : null}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Сегодня</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3">
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
        {stat("Отзывы на модерации", pendingReviews, "text-purple-500", reviewsHref)}
      </div>

      <p className="mt-6 text-xs text-gray-500">{revenueFootnote}</p>
    </div>
  );
}
