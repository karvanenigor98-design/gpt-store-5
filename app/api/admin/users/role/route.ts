import { NextRequest, NextResponse } from "next/server";

import { updateProfileFlexible } from "@/lib/admin/updateProfileFlexible";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { isServerAdmin } from "@/lib/auth/server-role";
import { isSuperAdminEmail } from "@/lib/auth/superAdmin";
import type { UserRole } from "@/types/database";

const VALID_ROLES = new Set(["client", "operator", "admin"]);

function adminDbForSite(site: "gpt-store" | "subs-store") {
  return site === "subs-store" ? createSubsStoreAdminClient() : createAdminClient();
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isServerAdmin(user))) {
      return NextResponse.json({ error: "Доступно только администратору" }, { status: 403 });
    }

    const body = (await request.json()) as { userId?: string; role?: string; site?: string };
    const userId = (body.userId ?? "").trim();
    const role = (body.role ?? "").trim() as UserRole;
    const site: "gpt-store" | "subs-store" = body.site === "subs-store" ? "subs-store" : "gpt-store";

    if (!userId || !VALID_ROLES.has(role)) {
      return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
    }

    const db = adminDbForSite(site);
    if (!db) {
      return NextResponse.json(
        { error: "Subs Supabase админ недоступен: проверьте SUBS_SUPABASE_URL и SUBS_SUPABASE_SERVICE_ROLE_KEY" },
        { status: 503 },
      );
    }

    let { data: targetProf } = await db
      .from("profiles")
      .select("email, role")
      .eq("id", userId)
      .maybeSingle();

    if (!targetProf) {
      const { data: authData, error: authErr } = await db.auth.admin.getUserById(userId);
      if (authErr || !authData?.user) {
        return NextResponse.json(
          { error: `Нет пользователя и в profiles, и в auth.users (${site})` },
          { status: 404 },
        );
      }
      const authEmail = authData.user.email ?? null;
      const { error: upErr } = await db.from("profiles").upsert(
        {
          id: userId,
          email: authEmail,
          role: "client",
        },
        { onConflict: "id" },
      );
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
      targetProf = { email: authEmail, role: "client" };
    }

    if (isSuperAdminEmail(targetProf.email) && role !== "admin") {
      return NextResponse.json(
        { error: "Нельзя изменить роль супер-администратора" },
        { status: 403 },
      );
    }

    const prevRole = (targetProf.role ?? "client") as UserRole;
    if (prevRole === "admin" && role !== "admin") {
      const { count, error: countErr } = await db
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      if (countErr) {
        return NextResponse.json({ error: countErr.message }, { status: 400 });
      }
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "Нельзя снять последнего администратора в этой базе" },
          { status: 403 },
        );
      }
    }

    const profileUpdate = await updateProfileFlexible(db, userId, { role });
    if (!profileUpdate.ok) {
      return NextResponse.json({ error: profileUpdate.error }, { status: 400 });
    }

    try {
      const membershipRole = role === "admin" ? "admin" : role === "operator" ? "operator" : "customer";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).from("site_memberships").upsert(
        { user_id: userId, site_slug: site, role: membershipRole },
        { onConflict: "user_id,site_slug" },
      );
    } catch {
      /* optional table */
    }

    try {
      await db.from("role_audit").insert({
        actor_id: user.id,
        target_id: userId,
        action: "set_role",
        payload: { from: prevRole, to: role, site },
      });
    } catch {
      /* audit optional — роль в profiles уже сохранена */
    }

    return NextResponse.json({ ok: true, role, previousRole: prevRole });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
