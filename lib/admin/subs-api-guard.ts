import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { isSuperAdminEmail, normalizeAuthEmail } from "@/lib/auth/superAdmin";
import { resolveServerRole } from "@/lib/auth/server-role";
import type { UserRole } from "@/types/database";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SubsStoreAdmin = NonNullable<ReturnType<typeof createSubsStoreAdminClient>>;

export type SubsApiOk = {
  user: User;
  role: UserRole;
  gptAdmin: ReturnType<typeof createAdminClient>;
  subs: SubsStoreAdmin;
};

function parseEmailSet(value: string | undefined): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Локальный dev/staff: ADMIN_EMAIL(S), OPERATOR_EMAIL(S) из env */
export function hasEnvListedStaffAccess(email: string | null | undefined): boolean {
  const n = normalizeAuthEmail(email);
  if (!n) return false;
  const direct = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (direct && n === direct) return true;
  const opDirect = process.env.OPERATOR_EMAIL?.trim().toLowerCase();
  if (opDirect && n === opDirect) return true;
  return parseEmailSet(process.env.ADMIN_EMAILS).has(n) || parseEmailSet(process.env.OPERATOR_EMAILS).has(n);
}

/**
 * Staff (admin or operator) with Subs Store access.
 * Оператору нужна строка site_memberships (subs-store) в GPT Supabase — см. syncStaffSiteMembershipsInGpt.
 */
export async function requireSubsStaffContext(options?: {
  /** If true, only `admin` role (not operator). Default false. */
  adminOnly?: boolean;
  /** Для уведомлений/бейджей: пропустить проверку site_memberships. */
  skipSiteMembershipCheck?: boolean;
}): Promise<SubsApiOk | NextResponse> {
  const adminOnly = options?.adminOnly ?? false;
  const skipSiteMembershipCheck = options?.skipSiteMembershipCheck ?? false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await resolveServerRole(user);
  if (role !== "admin" && role !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (adminOnly && role !== "admin") {
    return NextResponse.json({ error: "Только администратор" }, { status: 403 });
  }

  const subs = createSubsStoreAdminClient();
  if (!subs) {
    return NextResponse.json(
      { error: "Subs Store не подключён: задайте SUBS_SUPABASE_URL и SUBS_SUPABASE_SERVICE_ROLE_KEY на сервере." },
      { status: 503 }
    );
  }

  const gptAdmin = createAdminClient();
  if (role === "operator" && !skipSiteMembershipCheck) {
    const canUseSubsByEmail = isSuperAdminEmail(user.email) || hasEnvListedStaffAccess(user.email);
    if (!canUseSubsByEmail) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (gptAdmin.from("site_memberships") as any)
          .select("site_slug")
          .eq("user_id", user.id)
          .eq("site_slug", "subs-store")
          .maybeSingle();
        if (!data) {
          return NextResponse.json({ error: "Нет доступа к SPOTIFY STORE" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Нет доступа к SPOTIFY STORE" }, { status: 403 });
      }
    }
  }
  return { user, role, gptAdmin, subs };
}

export async function listAccessibleAdminSiteSlugs(
  user: User | null,
  gptAdmin: SupabaseClient,
  role?: UserRole | null,
): Promise<("gpt-store" | "subs-store")[]> {
  const base: ("gpt-store" | "subs-store")[] = ["gpt-store"];
  if (!user) return base;

  const subsConfigured = Boolean(createSubsStoreAdminClient());

  /** Staff (admin/operator) видит оба магазина, если Subs подключён. */
  if ((role === "admin" || role === "operator") && subsConfigured) {
    return ["gpt-store", "subs-store"];
  }

  if (isSuperAdminEmail(user.email) || hasEnvListedStaffAccess(user.email)) {
    return subsConfigured ? ["gpt-store", "subs-store"] : base;
  }

  if (role === "operator" && !subsConfigured) {
    return base;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (gptAdmin.from("site_memberships") as any)
      .select("site_slug")
      .eq("user_id", user.id)
      .eq("site_slug", "subs-store")
      .maybeSingle();
    if (!error && data) {
      return ["gpt-store", "subs-store"];
    }
  } catch {
    /* ignore */
  }
  return base;
}
