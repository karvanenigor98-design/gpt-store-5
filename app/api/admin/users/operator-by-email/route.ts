import { NextRequest, NextResponse } from "next/server";

import { isServerAdmin } from "@/lib/auth/server-role";
import { roleAfterGrant } from "@/lib/auth/staffRoleMerge";
import {
  syncStaffSiteMembershipsInGpt,
  upsertStaffSiteMembershipOnDb,
} from "@/lib/auth/syncStaffSiteMemberships";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { UserRole } from "@/types/database";

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
      return NextResponse.json({ error: "Только админ может назначать операторов" }, { status: 403 });
    }

    const body = (await request.json()) as { email?: string; site?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const site: "gpt-store" | "subs-store" = body.site === "subs-store" ? "subs-store" : "gpt-store";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Введите корректный email" }, { status: 400 });
    }

    const db = adminDbForSite(site);
    if (!db) {
      return NextResponse.json(
        { error: "Subs Supabase админ недоступен: проверьте SUBS_SUPABASE_URL и SUBS_SUPABASE_SERVICE_ROLE_KEY" },
        { status: 503 },
      );
    }

    const { data: profile, error: findError } = await db
      .from("profiles")
      .select("id, email, role")
      .ilike("email", email)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 400 });
    }
    if (!profile?.id) {
      return NextResponse.json(
        {
          error:
            site === "subs-store"
              ? "Профиль не найден в Subs Store. Убедитесь, что пользователь зарегистрировался именно на Spotify / subs-store и что строка есть в таблице profiles."
              : "Пользователь с таким email не найден. Сначала пусть зарегистрируется.",
        },
        { status: 404 },
      );
    }

    const nextRole = roleAfterGrant((profile.role ?? "client") as UserRole, "operator");
    const { error: updateError } = await db.from("profiles").update({ role: nextRole }).eq("id", profile.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    const { error: auditErr } = await db.from("role_audit").insert({
      actor_id: user.id,
      target_id: profile.id,
      action: "grant_operator_by_email",
      payload: { email, site },
    });
    if (auditErr && site === "gpt-store") {
      return NextResponse.json({ error: auditErr.message }, { status: 400 });
    }

    await upsertStaffSiteMembershipOnDb(db, profile.id, site, nextRole);

    const gptAdmin = createAdminClient();
    if (gptAdmin) {
      await syncStaffSiteMembershipsInGpt(gptAdmin, profile.id, nextRole);
    }

    return NextResponse.json({
      ok: true,
      message: `Аккаунт ${profile.email ?? email} назначен оператором (${site === "subs-store" ? "Subs Store" : "GPT Store"})`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
