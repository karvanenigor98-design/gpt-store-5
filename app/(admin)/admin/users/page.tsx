import { createAdminClient, createClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/requireAdminPage";
import { ReferralAdminPanel } from "@/components/admin/ReferralAdminPanel";
import { UsersRoleManager } from "./UsersRoleManager";
import { resolveAdminSiteSlug } from "@/lib/admin/siteFilter";
import { getSiteBySlug } from "@/lib/sites";
import { resolveSubsProfileIdByEmail } from "@/lib/admin/transferStaffAndData";
import { selectProfilesFlexible } from "@/lib/admin/selectProfilesFlexible";
import { resolveRoleByEmail } from "@/lib/auth/resolveRole";
import { effectiveRoleFromProfile } from "@/lib/auth/superAdmin";
import type { UserRole } from "@/types/database";

export const metadata: Metadata = { title: "Admin · Пользователи" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  await requireAdminPage();

  const { site: siteParam } = await searchParams;
  const siteSlug = resolveAdminSiteSlug({ site: siteParam });
  const site = getSiteBySlug(siteSlug);

  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  type SlimProfile = {
    id: string;
    email: string | null;
    telegram_username: string | null;
    role: UserRole | null;
    created_at: string;
    referral_code: string | null;
    referred_by_user_id: string | null;
  };

  let loadError: string | null = null;
  let merged: {
    id: string;
    email: string | null;
    telegram_username: string | null;
    role: UserRole;
    created_at: string;
  }[] = [];

  const db =
    siteSlug === "subs-store" ?
      createSubsStoreAdminClient()
    : createAdminClient();
  if (!db) {
    return (
      <div className="p-6">
        <h1 className="mb-2 font-heading text-2xl font-bold text-gray-900">Пользователи · SPOTIFY STORE</h1>
        <p className="max-w-xl text-sm text-gray-600">
          Укажите <code className="rounded bg-gray-100 px-1">SUBS_SUPABASE_URL</code> и{" "}
          <code className="rounded bg-gray-100 px-1">SUBS_SUPABASE_SERVICE_ROLE_KEY</code>.
        </p>
      </div>
    );
  }

  const profileSelect = await selectProfilesFlexible(db, [
    "id",
    "email",
    "telegram_username",
    "role",
    "created_at",
    "referral_code",
    "referred_by_user_id",
  ]);

  if (profileSelect.error) {
    loadError = profileSelect.error;
  }

  const profileRows = profileSelect.rows.map((p) => ({
    id: String(p.id),
    email: (p.email as string | null) ?? null,
    telegram_username: (p.telegram_username as string | null) ?? null,
    role: (p.role as UserRole | null) ?? null,
    created_at: String(p.created_at ?? new Date(0).toISOString()),
    referral_code: ("referral_code" in p ? (p.referral_code as string | null) : null) ?? null,
    referred_by_user_id:
      ("referred_by_user_id" in p ? (p.referred_by_user_id as string | null) : null) ?? null,
  })) as SlimProfile[];

  const profileById = new Map(profileRows.map((p) => [p.id, p]));

  const authUsers: { id: string; email: string | null; created_at: string | null }[] = [];
  let page = 1;
  while (page <= 50) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      loadError =
        loadError ??
        `${siteSlug === "subs-store" ? "Subs Store Auth" : "GPT Store Auth"}: ${error.message || "ошибка listUsers"}`;
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

  merged = authUsers.map((au) => {
    const p = profileById.get(au.id);
    const email = p?.email ?? au.email ?? null;
    const fromProfile = effectiveRoleFromProfile((p?.role ?? null) as UserRole | null, email);
    const byEmail = resolveRoleByEmail(email);
    const mappedRole: UserRole = fromProfile === "client" && byEmail !== "client" ? byEmail : fromProfile;
    return {
      id: au.id,
      email,
      telegram_username: p?.telegram_username ?? null,
      role: mappedRole,
      created_at: p?.created_at ?? au.created_at ?? new Date(0).toISOString(),
    };
  });

  const userIds = merged.map((u) => u.id);
  const { data: orders } = userIds.length
    ? await db
        .from("orders")
        .select("id, user_id, price, status, created_at")
        .in("user_id", userIds)
    : { data: [] as { id: string; user_id: string | null; price: unknown; status: string | null; created_at: string }[] };

  const paidStatuses =
    siteSlug === "subs-store" ?
      ["paid", "processing", "awaiting_data", "activated", "completed"]
    : ["paid", "activating", "active", "waiting_client"];

  const ordersByUser = new Map<string, { count: number; paidTotal: number; lastOrderAt: string | null }>();
  for (const o of orders ?? []) {
    const key = o.user_id ?? "";
    if (!key) continue;
    const prev = ordersByUser.get(key) ?? { count: 0, paidTotal: 0, lastOrderAt: null };
    prev.count += 1;
    if (paidStatuses.includes(o.status ?? "")) {
      prev.paidTotal += Number(o.price ?? 0);
    }
    if (!prev.lastOrderAt || new Date(o.created_at).getTime() > new Date(prev.lastOrderAt).getTime()) {
      prev.lastOrderAt = o.created_at;
    }
    ordersByUser.set(key, prev);
  }

  const referralsByReferrer = new Map<string, number>();
  try {
    type RefEventRow = { referrer_user_id: string | null };
    const { data: refRows } = await (
      db as import("@supabase/supabase-js").SupabaseClient
    )
      .from("referral_events")
      .select("referrer_user_id");
    for (const r of (refRows ?? []) as RefEventRow[]) {
      const id = String(r.referrer_user_id ?? "");
      if (!id) continue;
      referralsByReferrer.set(id, (referralsByReferrer.get(id) ?? 0) + 1);
    }
  } catch {
    /* миграция 012/005 ещё не применена */
  }

  const emailById = new Map(profileRows.map((p) => [p.id, p.email]));

  const preparedUsers = merged.map((u) => {
    const prof = profileById.get(u.id);
    const referredById = prof?.referred_by_user_id ?? null;
    return {
      ...u,
      role: (u.role ?? "client") as "client" | "operator" | "admin",
      ordersCount: ordersByUser.get(u.id)?.count ?? 0,
      paidTotal: ordersByUser.get(u.id)?.paidTotal ?? 0,
      lastOrderAt: ordersByUser.get(u.id)?.lastOrderAt ?? null,
      referralCode: prof?.referral_code ?? null,
      referredByEmail: referredById ? (emailById.get(referredById) ?? referredById.slice(0, 8)) : null,
      referralsCount: referralsByReferrer.get(u.id) ?? 0,
    };
  });

  let currentUserIdForTransfer = user?.id ?? "";
  if (siteSlug === "subs-store" && db && user?.email) {
    const subsSelfId = await resolveSubsProfileIdByEmail(db, user.email);
    if (subsSelfId) currentUserIdForTransfer = subsSelfId;
  }

  return (
    <div className="p-6">
      <h1 className="mb-2 font-heading text-2xl font-bold text-gray-900">
        Пользователи
        <span className="ml-3 text-base font-normal text-gray-500">{site.brandName}</span>
      </h1>
      <p className="mb-5 max-w-2xl text-sm text-gray-600">
        Все зарегистрированные пользователи{" "}
        {site.brandName} — из{" "}
        <code className="rounded bg-gray-100 px-1">auth.users</code>, строки профиля подтягиваются когда есть в{" "}
        <code className="rounded bg-gray-100 px-1">profiles</code>.
      </p>
      {loadError && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          Предупреждение загрузки: {loadError}
        </p>
      )}
      <ReferralAdminPanel adminSite={siteSlug} />
      <UsersRoleManager
        users={preparedUsers}
        currentUserId={currentUserIdForTransfer}
        adminSite={siteSlug}
      />
    </div>
  );
}
