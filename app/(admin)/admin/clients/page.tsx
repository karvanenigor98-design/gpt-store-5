import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { resolveRoleByEmail } from "@/lib/auth/resolveRole";
import { resolveServerRole } from "@/lib/auth/server-role";
import { effectiveRoleFromProfile } from "@/lib/auth/superAdmin";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import type { UserRole } from "@/types/database";
import { selectProfilesFlexible } from "@/lib/admin/selectProfilesFlexible";
import { resolveAdminSiteSlug } from "@/lib/admin/siteFilter";
import { getSiteBySlug } from "@/lib/sites";
import {
  formatAdminActiveSubscriptionLabel,
  inferGptPlanDurationMonths,
  resolveGptAdminActivePlanTitle,
  resolveSubsAdminActivePlanTitle,
} from "@/lib/admin/admin-subscription-label";

export const metadata: Metadata = { title: "Admin · Клиенты" };
const ROLE_PRIORITY: Record<UserRole, number> = { admin: 0, operator: 1, client: 2 };

const STAGE_RU: Record<string, string> = {
  purchased: "Купил",
  waiting: "В ожидании",
  no_purchase: "Не покупал",
  needs_help: "Нужна помощь",
  other: "Другое",
};

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ highlight?: string; role?: "all" | "client" | "operator" | "admin"; site?: string }>;
}) {
  const { highlight, role: roleFilterRaw, site: siteParam } = await searchParams;
  const siteSlug = resolveAdminSiteSlug({ site: siteParam });
  const site = getSiteBySlug(siteSlug);
  const roleFilter =
    roleFilterRaw === "client" || roleFilterRaw === "operator" || roleFilterRaw === "admin"
      ? roleFilterRaw
      : "all";
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  const role = await resolveServerRole(user);
  if (role !== "admin" && role !== "operator") {
    redirect("/dashboard");
  }

  type ProfileRow = {
    id: string;
    email: string | null;
    username: string | null;
    telegram_id: number | null;
    telegram_username: string | null;
    role: UserRole;
    created_at: string;
    last_seen: string | null;
    notes: string | null;
    tags: string[] | null;
    client_stage: string | null;
  };

  type OrderAgg = {
    user_id: string | null;
    status: string;
    plan_id?: string | null;
    product?: string | null;
    plan_name?: string | null;
    id?: string;
    planTitle?: string | null;
    tariff_id?: string | null;
    activated_at?: string | null;
    expires_at?: string | null;
    paid_at?: string | null;
    durationMonths?: number | null;
  };

  let profilesError: { message: string } | null = null;
  let mergedRows: {
    id: string;
    email: string | null;
    username: string | null;
    telegram_id: number | null;
    telegram_username: string | null;
    role: UserRole;
    created_at: string;
    last_seen: string | null;
    notes: string | null;
    tags: string[] | null;
    client_stage: string | null;
    has_profile: boolean;
  }[] = [];
  let orders: OrderAgg[] = [];
  /** Subs Store: активность клиента — заказ в Supabase Subs или тред поддержки chat_threads там же */
  let subsActivityIds: Set<string> | null = null;

  if (siteSlug === "subs-store") {
    const subs = createSubsStoreAdminClient();
    if (!subs) {
      return (
        <div className="p-6">
          <h1 className="font-heading text-2xl font-bold text-gray-900">Клиенты · Subs Store</h1>
          <p className="mt-2 max-w-xl text-sm text-gray-600">
            Подключите <code className="rounded bg-gray-100 px-1">SUBS_SUPABASE_URL</code> и{" "}
            <code className="rounded bg-gray-100 px-1">SUBS_SUPABASE_SERVICE_ROLE_KEY</code> в проекте GPT STORE (тот же
            проект Supabase, что и у лендинга subs-store).
          </p>
        </div>
      );
    }

    subsActivityIds = new Set<string>();
    try {
      const { data: threadRows, error: thErr } = await subs
        .from("chat_threads")
        .select("user_id")
        .not("user_id", "is", null)
        .limit(5000);
      if (thErr) {
        profilesError = { message: `Поддержка Subs Store (chat_threads в Subs-проекте): ${thErr.message}` };
      }
      for (const row of threadRows ?? []) {
        const uid = (row as { user_id?: string | null }).user_id;
        if (uid) subsActivityIds.add(String(uid));
      }
    } catch {
      /* таблицы может не быть */
    }

    const subsOrdersSelect =
      "user_id, status, tariff_id, id, activated_at, expires_at, paid_at";
    let subsOrdersRaw: Record<string, unknown>[] | null = null;
    let ordErr: { message: string } | null = null;

    const extendedOrders = await subs
      .from("orders")
      .select(subsOrdersSelect)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (extendedOrders.error && /does not exist|column .* does not/i.test(extendedOrders.error.message)) {
      const baseOrders = await subs
        .from("orders")
        .select("user_id, status, tariff_id, id, paid_at")
        .order("created_at", { ascending: false })
        .limit(2000);
      subsOrdersRaw = (baseOrders.data ?? []) as Record<string, unknown>[];
      ordErr = baseOrders.error;
    } else {
      subsOrdersRaw = (extendedOrders.data ?? []) as Record<string, unknown>[];
      ordErr = extendedOrders.error;
    }

    if (ordErr) {
      profilesError =
        profilesError ??
        {
          message: `Заказы Subs Store: ${ordErr.message}. Если есть связь через PostgREST, проверьте таблицы orders/plan_id и тарифы.`,
        };
    }

    const titleByTariffId = new Map<
      string,
      { title: string | null; slug: string | null; category: string | null; duration_months: number | null }
    >();
    if (subsOrdersRaw?.length) {
      const tariffIds = new Set<string>();
      for (const r of subsOrdersRaw) {
        const tid = (r as { tariff_id?: string | null }).tariff_id;
        if (tid && String(tid).trim()) tariffIds.add(String(tid).trim());
      }
      if (tariffIds.size > 0) {
        const { data: tariffRows, error: tErr } = await subs
          .from("tariffs")
          .select("id, slug, title, category, duration_months")
          .in("id", [...tariffIds]);
        if (tErr) {
          profilesError =
            profilesError ?? { message: `Тарифы Subs (для названий заказов): ${tErr.message}` };
        }
        for (const t of tariffRows ?? []) {
          const id = (t as { id?: string }).id;
          if (!id) continue;
          titleByTariffId.set(String(id), {
            title: (t as { title?: string | null }).title ?? null,
            slug: (t as { slug?: string | null }).slug ?? null,
            category: (t as { category?: string | null }).category ?? null,
            duration_months:
              (t as { duration_months?: number | null }).duration_months != null
                ? Number((t as { duration_months?: number | null }).duration_months)
                : null,
          });
        }
      }
    }

    orders = (subsOrdersRaw ?? []).map((raw) => {
      const row = raw as {
        user_id?: string | null;
        status?: string;
        tariff_id?: string | null;
        id?: string;
        activated_at?: string | null;
        expires_at?: string | null;
        paid_at?: string | null;
      };
      const tariffId = row.tariff_id ? String(row.tariff_id).trim() : "";
      const tariffMeta = tariffId ? titleByTariffId.get(tariffId) : null;
      return {
        user_id: row.user_id ?? null,
        status: String(row.status ?? ""),
        tariff_id: row.tariff_id ?? null,
        id: row.id,
        activated_at: row.activated_at ?? null,
        expires_at: row.expires_at ?? null,
        paid_at: row.paid_at ?? null,
        durationMonths: tariffMeta?.duration_months ?? null,
        planTitle: resolveSubsAdminActivePlanTitle(tariffMeta ?? null),
      };
    }) as unknown as OrderAgg[];
    for (const o of orders) {
      const uid = o.user_id;
      if (uid) subsActivityIds.add(String(uid));
    }

    const profileSelect = await selectProfilesFlexible(subs, [
      "id",
      "email",
      "username",
      "telegram_id",
      "telegram_username",
      "role",
      "created_at",
      "last_seen",
      "notes",
      "tags",
      "client_stage",
    ]);

    if (profileSelect.error) {
      profilesError = profilesError ?? { message: profileSelect.error };
    }

    const profiles = profileSelect.rows.map((p) => ({
      id: String(p.id),
      email: (p.email as string | null) ?? null,
      username: (p.username as string | null) ?? null,
      telegram_id: (p.telegram_id as number | null) ?? null,
      telegram_username: (p.telegram_username as string | null) ?? null,
      role: (p.role as UserRole) ?? "client",
      created_at: String(p.created_at ?? new Date(0).toISOString()),
      last_seen: (p.last_seen as string | null) ?? null,
      notes: (p.notes as string | null) ?? null,
      tags: (p.tags as string[] | null) ?? null,
      client_stage: (p.client_stage as string | null) ?? null,
    })) as ProfileRow[];

    const authUsers: { id: string; email: string | null; created_at: string | null }[] = [];
    let authPage = 1;
    while (authPage <= 50) {
      const { data, error } = await subs.auth.admin.listUsers({ page: authPage, perPage: 100 });
      if (error) {
        profilesError =
          profilesError ?? { message: `Пользователи Auth (Subs Store): ${error.message || "ошибка listUsers"}` };
        break;
      }
      const list = data.users ?? [];
      if (!list.length) break;
      for (const u of list) {
        authUsers.push({ id: u.id, email: u.email ?? null, created_at: u.created_at ?? null });
      }
      if (list.length < 100) break;
      authPage += 1;
    }

    const profileById = new Map(profiles.map((p) => [p.id, p]));
    mergedRows = authUsers.map((au) => {
      const p = profileById.get(au.id);
      const email = p?.email ?? au.email ?? null;
      const fromProfile = effectiveRoleFromProfile((p?.role ?? null) as UserRole | null, email);
      const byEmail = resolveRoleByEmail(email);
      const mappedRole: UserRole = fromProfile === "client" && byEmail !== "client" ? byEmail : fromProfile;
      return {
        id: au.id,
        email,
        username: p?.username ?? null,
        telegram_id: p?.telegram_id ?? null,
        telegram_username: p?.telegram_username ?? null,
        role: mappedRole,
        created_at: p?.created_at ?? au.created_at ?? new Date(0).toISOString(),
        last_seen: p?.last_seen ?? null,
        notes: p?.notes ?? null,
        tags: p?.tags ?? [],
        client_stage: p?.client_stage ?? null,
        has_profile: Boolean(p),
      };
    });
  } else {
    const admin = createAdminClient();

    let profileRows: ProfileRow[] | null = null;

    const fullSelect = await admin
      .from("profiles")
      .select(
        "id, email, username, telegram_id, telegram_username, role, created_at, last_seen, notes, tags, client_stage"
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (fullSelect.error?.message?.includes("client_stage")) {
      const fallbackSelect = await admin
        .from("profiles")
        .select("id, email, username, telegram_id, telegram_username, role, created_at, last_seen, notes, tags")
        .order("created_at", { ascending: false })
        .limit(500);
      profilesError = fallbackSelect.error ? { message: fallbackSelect.error.message } : null;
      profileRows = (fallbackSelect.data ?? []).map((p) => ({ ...p, client_stage: null }));
    } else {
      profilesError = fullSelect.error ? { message: fullSelect.error.message } : null;
      profileRows = fullSelect.data ?? null;
    }

    const profiles = profileRows ?? [];

    const authUsers: { id: string; email: string | null; created_at: string | null }[] = [];
    let page = 1;
    while (page <= 20) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) {
        profilesError =
          profilesError ?? {
            message: `Пользователи Auth (GPT Store): ${error.message || "ошибка listUsers"}`,
          };
        break;
      }
      const list = data.users ?? [];
      if (!list.length) break;
      for (const u of list) {
        authUsers.push({ id: u.id, email: u.email ?? null, created_at: u.created_at ?? null });
      }
      if (list.length < 100) break;
      page += 1;
    }

    const profileById = new Map(profiles.map((p) => [p.id, p]));

    mergedRows = authUsers.map((au) => {
      const p = profileById.get(au.id);
      const email = p?.email ?? au.email ?? null;
      const fromProfile = effectiveRoleFromProfile((p?.role ?? null) as UserRole | null, email);
      const byEmail = resolveRoleByEmail(email);
      const mappedRole: UserRole = fromProfile === "client" && byEmail !== "client" ? byEmail : fromProfile;
      return {
        id: au.id,
        email,
        username: p?.username ?? null,
        telegram_id: p?.telegram_id ?? null,
        telegram_username: p?.telegram_username ?? null,
        role: mappedRole,
        created_at: p?.created_at ?? au.created_at ?? new Date(0).toISOString(),
        last_seen: p?.last_seen ?? null,
        notes: p?.notes ?? null,
        tags: p?.tags ?? [],
        client_stage: p?.client_stage ?? null,
        has_profile: Boolean(p),
      };
    });

    const allUserIds = mergedRows.map((r) => r.id).filter((id) => id !== (user?.id ?? ""));

    const siteOrdersQuery = allUserIds.length
      ? admin
          .from("orders")
          .select(
            "user_id, status, plan_id, price, created_at, product, activated_at, expires_at, paid_at, plan_name",
          )
          .in("user_id", allUserIds)
      : null;

    const { data: allOrders } = siteOrdersQuery
      ? await siteOrdersQuery.not("product", "ilike", "spotify%")
      : { data: [] };

    orders = (allOrders ?? []).map((raw) => {
      const row = raw as OrderAgg;
      return {
        ...row,
        planTitle: resolveGptAdminActivePlanTitle({
          plan_id: String(row.plan_id ?? ""),
          product: row.product ?? null,
          plan_name: row.plan_name ?? null,
        }),
        durationMonths: inferGptPlanDurationMonths(String(row.plan_id ?? "")),
      };
    }) as unknown as OrderAgg[];
  }

  const isSubsStoreSite = siteSlug === "subs-store";
  const staffChatBase = role === "operator" ? "/operator/chat" : "/admin/chat";

  const clients = mergedRows
    .filter((r) => r.id !== (user?.id ?? ""))
    .filter((r) => (roleFilter === "all" ? true : r.role === roleFilter))
    .filter((r) => {
      if (r.role === "admin" || r.role === "operator") return true;
      return r.role === "client";
    })
    .sort((a, b) => {
      const rp = ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role];
      if (rp !== 0) return rp;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const ordersByUser = new Map<string, typeof orders>();
  for (const o of orders) {
    if (!o.user_id) continue;
    const arr = ordersByUser.get(o.user_id) ?? [];
    arr.push(o);
    ordersByUser.set(o.user_id, arr);
  }

  return (
    <div className="p-6">
      <h1 className="mb-2 font-heading text-2xl font-bold text-gray-900">
        Клиенты
        <span className="ml-3 text-base font-normal" style={{ color: site.primaryColor }}>
          {site.brandName}
        </span>
      </h1>
      <p className="mb-6 text-sm text-gray-600">
        {isSubsStoreSite
          ? "Все зарегистрированные пользователи Subs Store (auth.users в Supabase Spotify). Колонки заказов и этапа — по активности в этом проекте. Сотрудники показываются всегда."
          : `Все зарегистрированные пользователи ${site.brandName} (auth.users). Колонки заказов и этапа — по активности в GPT STORE. Сотрудники показываются всегда.`}
      </p>
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {[
          { key: "all", label: "Все" },
          { key: "client", label: "Клиенты" },
          { key: "operator", label: "Операторы" },
          { key: "admin", label: "Админы" },
        ].map((f) => {
          const active = roleFilter === f.key;
          const href =
            f.key === "all"
              ? `/admin/clients?site=${siteSlug}`
              : `/admin/clients?role=${f.key}&site=${siteSlug}`;
          return (
            <Link
              key={f.key}
              href={href}
              className={
                active
                  ? "rounded-full border border-[#10a37f]/30 bg-[#10a37f]/10 px-3 py-1 text-[#0f7d62]"
                  : "rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-600 hover:text-gray-900"
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[1320px] text-left text-sm text-gray-700">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Клиент</th>
              <th className="px-4 py-3">Роль</th>
              <th className="px-4 py-3">Telegram</th>
              <th className="px-4 py-3">Профиль</th>
              <th className="px-4 py-3">Регистрация</th>
              <th className="px-4 py-3">Был в сети</th>
              <th className="px-4 py-3">Этап</th>
              <th className="px-4 py-3">Заказы</th>
              <th className="px-4 py-3">Подписка</th>
              <th className="px-4 py-3">Теги</th>
              <th className="px-4 py-3">Заметка</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(clients ?? []).map((c) => {
              const list = ordersByUser.get(c.id) ?? [];
              const active = isSubsStoreSite
                ? list.find((o) => o.status === "activated" || o.status === "processing")
                : list.find((o) => o.status === "active");
              const hasPaid = isSubsStoreSite
                ? list.some((o) =>
                    ["paid", "processing", "awaiting_data", "activated", "completed"].includes(o.status)
                  )
                : list.some((o) => ["paid", "activating", "active", "waiting_client"].includes(o.status));
              const stageKey = c.client_stage ?? (hasPaid ? "purchased" : list.length ? "waiting" : "no_purchase");
              const stageLabel = STAGE_RU[stageKey] ?? stageKey;
              const rowHi = highlight === c.id ? "bg-[#10a37f]/10" : "";

              const activeLabel = active
                ? formatAdminActiveSubscriptionLabel({
                    siteSlug: isSubsStoreSite ? "subs-store" : "gpt-store",
                    status: active.status,
                    planTitle:
                      active.planTitle ??
                      (isSubsStoreSite
                        ? "Spotify Premium"
                        : resolveGptAdminActivePlanTitle({
                            plan_id: String(active.plan_id ?? ""),
                            product: active.product ?? null,
                            plan_name: active.plan_name ?? null,
                          })),
                    expiresAtIso: active.expires_at,
                    activatedAtIso: active.activated_at,
                    paidAtIso: active.paid_at,
                    durationMonths: active.durationMonths,
                  })
                : null;

              return (
                <tr key={c.id} className={rowHi}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{c.username ?? "—"}</p>
                    <p className="text-xs text-gray-500">{c.email ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">{c.role}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {c.telegram_username ? `@${c.telegram_username}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {c.has_profile ? (
                      <span className="text-emerald-600">есть</span>
                    ) : (
                      <span className="text-amber-600">нет (только auth)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(c.created_at).toLocaleDateString("ru")}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {c.last_seen ? new Date(c.last_seen).toLocaleString("ru-RU") : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">{stageLabel}</td>
                  <td className="px-4 py-3 text-xs">{list.length}</td>
                  <td className="px-4 py-3 text-xs">{activeLabel ?? "—"}</td>
                  <td className="max-w-[220px] px-4 py-3 text-xs text-gray-400">
                    {c.tags?.length ? c.tags.join(", ") : "—"}
                  </td>
                  <td className="max-w-[280px] px-4 py-3 text-xs text-gray-400">
                    {c.notes ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`${staffChatBase}?site=${encodeURIComponent(siteSlug)}&client_id=${encodeURIComponent(c.id)}`}
                      className="inline-flex items-center gap-1 text-[#10a37f] hover:underline"
                    >
                      <MessageCircle size={14} />
                      Чат
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {profilesError && (
          <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-900">
            Предупреждение при загрузке данных: {profilesError.message}
          </p>
        )}
        {(!clients || clients.length === 0) && (
          <p className="p-6 text-sm text-gray-500">Аккаунтов по выбранному фильтру пока нет</p>
        )}
      </div>
    </div>
  );
}
