import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { isMissingProfilesColumn } from "@/lib/admin/selectProfilesFlexible";
import { effectiveRoleFromProfile } from "@/lib/auth/superAdmin";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { createSubsAuthServerClient } from "@/lib/supabase/subs-auth-server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      username?: string;
      telegram_username?: string;
      site?: string;
    };
    const username = (body.username ?? "").trim();
    const telegramUsername = (body.telegram_username ?? "").trim().replace(/^@+/, "");

    const cookieStore = await cookies();
    const rawSite = body.site ?? cookieStore.get("current_site")?.value;
    const siteSlug: SiteSlug = rawSite === "subs-store" ? "subs-store" : "gpt-store";

    if (siteSlug === "subs-store") {
      const subsAuth = await createSubsAuthServerClient();
      if (!subsAuth) {
        return NextResponse.json(
          { error: "Subs Auth не настроен (NEXT_PUBLIC_SUBS_SUPABASE_*)" },
          { status: 503 },
        );
      }
      const {
        data: { user },
      } = await subsAuth.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
      }

      const subsAdmin = createSubsStoreAdminClient();
      if (!subsAdmin) {
        return NextResponse.json({ error: "Subs Store не подключён на сервере" }, { status: 503 });
      }

      const { data: existing } = await subsAdmin.from("profiles").select("id, role").eq("id", user.id).maybeSingle();

      const patch: Record<string, string | null> = {
        username: username || null,
        full_name: username || null,
        telegram_username: telegramUsername || null,
        last_seen: new Date().toISOString(),
      };

      const subsPatchWithoutTelegram = () => {
        const rest = { ...patch };
        delete rest.telegram_username;
        return rest;
      };

      if (!existing) {
        const role = effectiveRoleFromProfile(null, user.email);
        let { error: insErr } = await subsAdmin.from("profiles").insert({
          id: user.id,
          email: user.email ?? null,
          role,
          ...patch,
        });
        if (insErr && isMissingProfilesColumn(insErr.message, "telegram_username")) {
          ({ error: insErr } = await subsAdmin.from("profiles").insert({
            id: user.id,
            email: user.email ?? null,
            role,
            ...subsPatchWithoutTelegram(),
          }));
        }
        if (insErr) {
          return NextResponse.json({ error: insErr.message }, { status: 400 });
        }
        return NextResponse.json({ ok: true });
      }

      let { error } = await subsAdmin.from("profiles").update(patch).eq("id", user.id);
      if (error && isMissingProfilesColumn(error.message, "telegram_username")) {
        ({ error } = await subsAdmin.from("profiles").update(subsPatchWithoutTelegram()).eq("id", user.id));
      }
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: existing } = await admin.from("profiles").select("id, role").eq("id", user.id).maybeSingle();

    if (!existing) {
      const role = effectiveRoleFromProfile(null, user.email);
      const { error: insErr } = await admin.from("profiles").insert({
        id: user.id,
        email: user.email ?? null,
        role,
        username: username || null,
        telegram_username: telegramUsername || null,
        last_seen: new Date().toISOString(),
      });
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    const { error } = await admin
      .from("profiles")
      .update({
        username: username || null,
        telegram_username: telegramUsername || null,
        last_seen: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка сохранения профиля" },
      { status: 500 },
    );
  }
}
