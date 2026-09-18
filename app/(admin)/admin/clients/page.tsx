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
import {
  selectProfilesFlexible,
  type SelectProfilesFlexibleOptions,
} from "@/lib/admin/selectProfilesFlexible";
import { resolveAdminSiteSlug } from "@/lib/admin/siteFilter";
import { getSiteBySlug } from "@/lib/sites";
import { loadGptOrdersForUserIds } from "@/lib/admin/gpt-clients-orders-fetch";
import { AdminListPager } from "@/components/admin/AdminListPager";
import {
  formatAdminActiveSubscriptionLabel,
  inferDurationMonthsFromText,
  resolveGptAdminActivePlanTitle,
  resolveSubsAdminActivePlanTitle,
} from "@/lib/admin/admin-subscription-label";
import {
  buildAdminOrdersByUserId,
  gptClientHasPaidOrder,
  pickAdminActiveOrder,
  subsClientHasPaidOrder,
  type AdminClientOrderAgg,
} from "@/lib/admin/admin-clients-orders";
import { resolveStaffFocusOrder } from "@/lib/admin/resolve-staff-focus-order";
import { gptOrderStatusLabelRu } from "@/lib/admin/gpt-order-status-labels";
import { subsOrderStatusLabelRu } from "@/lib/admin/subs-order-status-labels";
import type { SupabaseClient } from "@supabase/supabase-js";

export const metadata: Metadata = { title: "Admin · Клиенты" };
const PAGE_SIZE = 50;
const ROLE_PRIORITY: Record<UserRole, number> = { admin: 0, operator: 1, client: 2 };

const STAGE_RU: Record<string, string> = {
  purchased: "Купил",
  waiting: "В ожидании",
  no_purchase: "Не покупал",
  needs_help: "Нужна помощь",
  other: "Другое",
};

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

type OrderAgg = AdminClientOrderAgg;

const PROFILE_COLUMNS = [
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
] as const;

function buildProfileSelectOptions(
  roleFilter: "all" | "client" | "operator" | "admin",
  offset: number,
  excludeId: string | null,
): SelectProfilesFlexibleOptions {
  const opts: SelectProfilesFlexibleOptions = {
    limit: PAGE_SIZE,
    offset,
    countExact: true,
    excludeId,
  };
  if (roleFilter === "admin" || roleFilter === "operator") {
    opts.roleEq = roleFilter;
  } else if (roleFilter === "client") {
    opts.roleIn = ["client", "admin", "operator"];
  }
  return opts;
}

async function loadSubsOrdersForUserIds(
  subs: SupabaseClient,
  userIds: string[],
): Promise<{ orders: OrderAgg[]; error: string | null }> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return { orders: [], error: null };

  const orderLimit = Math.min(ids.length * 40, 2000);
  const subsOrdersSelect =
    "user_id, status, tariff_id, id, activated_at, expires_at, paid_at, created_at";
  let subsOrdersRaw: Record<string, unknown>[] | null = null;
  let ordErr: { message: string } | null = null;

  const extendedOrders = await subs
    .from("orders")
    .select(subsOrdersSelect)
    .in("user_id", ids)
    .order("created_at", { ascending: false })
    .limit(orderLimit);

  if (extendedOrders.error && /does not exist|column .* does not/i.test(extendedOrders.error.message)) {
    const baseOrders = await subs
      .from("orders")
      .select("user_id, status, tariff_id, id, paid_at, created_at")
      .in("user_id", ids)
      .order("created_at", { ascending: false })
      .limit(orderLimit);
    subsOrdersRaw = (baseOrders.data ?? []) as Record<string, unknown>[];
    ordErr = baseOrders.error;
  } else {
    subsOrdersRaw = (extendedOrders.data ?? []) as Record<string, unknown>[];
    ordErr = extendedOrders.error;
  }

  if (ordErr) {
    return {
      orders: [],
      error: `Заказы Subs Store: ${ordErr.message}. Если есть связь через PostgREST, проверьте таблицы orders/plan_id и тарифы.`,
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
        return { orders: [], error: `Тарифы Subs (для названий заказов): ${tErr.message}` };
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

  const orders = (subsOrdersRaw ?? []).map((raw) => {
    const row = raw as {
      user_id?: string | null;
      status?: string;
      tariff_id?: string | null;
      id?: string;
      activated_at?: string | null;
      expires_at?: string | null;
      paid_at?: string | null;
      created_at?: string | null;
    };
    const tariffId = row.tariff_id ? String(row.tariff_id).trim() : "";
    const tariffMeta = tariffId ? titleByTariffId.get(tariffId) : null;
    const durationMonths =
      tariffMeta?.duration_months ??
      inferDurationMonthsFromText(tariffMeta?.title ?? null) ??
      null;
    const planTitle = resolveSubsAdminActivePlanTitle(
      tariffMeta ? { ...tariffMeta, duration_months: durationMonths } : null,
    );
    return {
      user_id: row.user_id ?? null,
      status: String(row.status ?? ""),
      tariff_id: row.tariff_id ?? null,
      id: row.id,
      activated_at: row.activated_at ?? null,
      expires_at: row.expires_at ?? null,
      paid_at: row.paid_at ?? null,
      created_at: row.created_at ?? null,
      durationMonths,
      planTitle,
    };
  }) as unknown as OrderAgg[];

  return { orders, error: null };
}

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    highlight?: string;
    role?: "all" | "client" | "operator" | "admin";
    site?: string;
    page?: string;
  }>;
}) {
  const { highlight, role: roleFilterRaw, site: siteParam, page: pageParam } = await searchParams;
  const siteSlug = resolveAdminSiteSlug({ site: siteParam });
  const site = getSiteBySlug(siteSlug);
  const roleFilter =
    roleFilterRaw === "client" || roleFilterRaw === "operator" || roleFilterRaw === "admin"
      ? roleFilterRaw
      : "all";
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  const role = await resolveServerRole(user);
  if (role !== "admin" && role !== "operator") {
    redirect("/dashboard");
  }

  const isSubsStoreSite = siteSlug === "subs-store";
  const db = isSubsStoreSite ? createSubsStoreAdminClient() : createAdminClient();

  if (!db) {
    return (
      <div className="p-6">
        <h1 className="font-heading text-2xl font-bold text-gray-900">
          Клиенты · {isSubsStoreSite ? "Subs Store" : site.brandName}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-gray-600">
          {isSubsStoreSite ? (
            <>
              Подключите <code className="rounded bg-gray-100 px-1">SUBS_SUPABASE_URL</code> и{" "}
              <code className="rounded bg-gray-100 px-1">SUBS_SUPABASE_SERVICE_ROLE_KEY</code> в проекте GPT STORE (тот
              же проект Supabase, что и у лендинга subs-store).
            </>
          ) : (
            <>Не удалось создать admin-клиент Supabase для {site.brandName}.</>
          )}
        </p>
      </div>
    );
  }

  let profilesError: { message: string } | null = null;

  const profileSelect = await selectProfilesFlexible(db, [...PROFILE_COLUMNS], {
    ...buildProfileSelectOptions(roleFilter, offset, user?.id ?? null),
  });

  if (profileSelect.error) {
    profilesError = { message: profileSelect.error };
  }

  const mergedRows = profileSelect.rows.map((p) => {
    const email = (p.email as string | null) ?? null;
    const fromProfile = effectiveRoleFromProfile((p.role as UserRole | null) ?? null, email);
    const byEmail = resolveRoleByEmail(email);
    const mappedRole: UserRole = fromProfile === "client" && byEmail !== "client" ? byEmail : fromProfile;
    return {
      id: String(p.id),
      email,
      username: (p.username as string | null) ?? null,
      telegram_id: (p.telegram_id as number | null) ?? null,
      telegram_username: (p.telegram_username as string | null) ?? null,
      role: mappedRole,
      created_at: String(p.created_at ?? new Date(0).toISOString()),
      last_seen: (p.last_seen as string | null) ?? null,
      notes: (p.notes as string | null) ?? null,
      tags: (p.tags as string[] | null) ?? [],
      client_stage: (p.client_stage as string | null) ?? null,
      has_profile: true,
    };
  }) as (ProfileRow & { has_profile: boolean })[];

  const clients = mergedRows
    .filter((r) => {
      if (roleFilter === "all") return true;
      if (r.role === "admin" || r.role === "operator") return true;
      return r.role === roleFilter;
    })
    .filter((r) => {
      if (r.role === "admin" || r.role === "operator") return true;
      return r.role === "client";
    })
    .sort((a, b) => {
      const rp = ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role];
      if (rp !== 0) return rp;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const pageIds = clients.map((c) => c.id);
  let orders: OrderAgg[] = [];

  if (pageIds.length > 0) {
    if (isSubsStoreSite) {
      const subsResult = await loadSubsOrdersForUserIds(db, pageIds);
      orders = subsResult.orders;
      if (subsResult.error) {
        profilesError = profilesError ?? { message: subsResult.error };
      }
    } else {
      const { orders: gptOrders, error: gptOrdersErr } = await loadGptOrdersForUserIds(db, pageIds);
      orders = gptOrders;
      if (gptOrdersErr) {
        profilesError = profilesError ?? { message: `Заказы GPT Store: ${gptOrdersErr}` };
      }
    }
  }

  const staffRoot = role === "operator" ? "/operator" : "/admin";
  const staffChatBase = `${staffRoot}/chat`;
  const ordersByUser = buildAdminOrdersByUserId(orders, clients);
  const total = profileSelect.count;
  const baseHref =
    roleFilter === "all"
      ? `${staffRoot}/clients?site=${siteSlug}`
      : `${staffRoot}/clients?site=${siteSlug}&role=${roleFilter}`;

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
          ? "Профили Subs Store из таблицы profiles (Supabase Spotify). Колонки заказов и этапа — по активности в этом проекте. Сотрудники показываются всегда."
          : `Профили ${site.brandName} из таблицы profiles. Колонки заказов и этапа — по активности в GPT STORE. Сотрудники показываются всегда.`}
        {total != null ? ` · всего ${total}` : ""}
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
              ? `${staffRoot}/clients?site=${siteSlug}`
              : `${staffRoot}/clients?role=${f.key}&site=${siteSlug}`;
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
              <th className="px-4 py-3">Последний заказ / Подписка</th>
              <th className="px-4 py-3">Теги</th>
              <th className="px-4 py-3">Заметка</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(clients ?? []).map((c) => {
              const siteKey = isSubsStoreSite ? "subs-store" : "gpt-store";
              const list = ordersByUser.get(c.id) ?? [];
              const focus = resolveStaffFocusOrder(
                list
                  .filter((o): o is AdminClientOrderAgg & { id: string; created_at: string } =>
                    Boolean(o.id && o.created_at),
                  )
                  .map((o) => ({
                    ...o,
                    id: String(o.id),
                    created_at: String(o.created_at),
                  })),
                siteKey,
              );
              const active = pickAdminActiveOrder(list, siteKey);
              const hasPaid = isSubsStoreSite ? subsClientHasPaidOrder(list) : gptClientHasPaidOrder(list);
              const stageKey = c.client_stage ?? (hasPaid ? "purchased" : list.length ? "waiting" : "no_purchase");
              const stageLabel = STAGE_RU[stageKey] ?? stageKey;
              const rowHi = highlight === c.id ? "bg-[#10a37f]/10" : "";

              const focusStatusLabel = focus
                ? siteKey === "subs-store"
                  ? subsOrderStatusLabelRu(focus.status)
                  : gptOrderStatusLabelRu(focus.status)
                : null;

              const activeLabel = active
                ? formatAdminActiveSubscriptionLabel({
                    siteSlug: siteKey,
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
                    createdAtIso: active.created_at,
                    durationMonths: active.durationMonths,
                  })
                : null;

              const showSubSeparately =
                Boolean(activeLabel) &&
                (!focus || !active?.id || focus.id !== active.id || focus.status !== active.status);

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
                  <td className="px-4 py-3 text-xs">
                    {focusStatusLabel ? (
                      <div className="space-y-0.5">
                        <p className="font-medium text-gray-900">{focusStatusLabel}</p>
                        {showSubSeparately && activeLabel ? (
                          <p className="text-[11px] text-gray-500">Подписка: {activeLabel}</p>
                        ) : activeLabel && !showSubSeparately ? (
                          <p className="text-[11px] text-gray-500">{activeLabel}</p>
                        ) : null}
                      </div>
                    ) : (
                      (activeLabel ?? "—")
                    )}
                  </td>
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
      <AdminListPager page={page} pageSize={PAGE_SIZE} total={total} baseHref={baseHref} />
    </div>
  );
}
