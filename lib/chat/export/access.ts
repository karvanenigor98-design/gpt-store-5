import { NextResponse } from "next/server";

import { requireSubsStaffContext } from "@/lib/admin/subs-api-guard";
import { getSiteUUID } from "@/lib/admin/getSiteId";
import { resolveServerRole } from "@/lib/auth/server-role";
import { isStaffSessionParticipant } from "@/lib/chat/staffSession";
import { getSiteBySlug, type SiteSlug } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { createSubsAuthServerClient } from "@/lib/supabase/subs-auth-server";
import { isSubsPublicAuthConfigured } from "@/lib/supabase/subs-auth-env";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { supabaseAdmin } from "@/lib/supabase/admin";

import type { ExportAccessContext } from "./types";

type SessionRow = {
  id: string;
  user_id: string | null;
  type: string;
  staff_peer_id: string | null;
  site_id: string | null;
};

function canAccessSupportSession(authUserId: string, sessionUserId: string | null, isStaff: boolean): boolean {
  if (isStaff) return true;
  if (!sessionUserId) return false;
  return sessionUserId === authUserId;
}

function canAccessGptSession(authUserId: string, session: SessionRow, isStaff: boolean): boolean {
  if (session.type === "staff") {
    return isStaff && isStaffSessionParticipant(session, authUserId);
  }
  if (session.type !== "operator" && session.type !== "ai") return false;
  return canAccessSupportSession(authUserId, session.user_id, isStaff);
}

export async function verifyChatExportAccess(params: {
  siteSlug: SiteSlug;
  chatId: string;
}): Promise<ExportAccessContext | NextResponse> {
  const siteSlug = params.siteSlug === "subs-store" ? "subs-store" : "gpt-store";
  const chatId = params.chatId.trim();
  if (!chatId) {
    return NextResponse.json({ error: "chat_id обязателен" }, { status: 400 });
  }

  if (siteSlug === "subs-store") {
    return verifySubsExportAccess(chatId);
  }
  return verifyGptExportAccess(chatId);
}

async function verifyGptExportAccess(chatId: string): Promise<ExportAccessContext | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await resolveServerRole(user);
  const isStaff = role === "admin" || role === "operator";

  const { data: sessionRow, error } = await supabaseAdmin
    .from("chat_sessions")
    .select("id, user_id, type, staff_peer_id, site_id")
    .eq("id", chatId)
    .maybeSingle();

  if (error || !sessionRow?.id) {
    return NextResponse.json({ error: "Чат не найден" }, { status: 404 });
  }

  const session = sessionRow as SessionRow;
  if (!canAccessGptSession(user.id, session, isStaff)) {
    return NextResponse.json({ error: "Нет доступа к этому чату" }, { status: 403 });
  }

  const gptSiteId = await getSiteUUID("gpt-store");
  if (gptSiteId && session.site_id && session.site_id !== gptSiteId) {
    return NextResponse.json({ error: "Чат не принадлежит GPT STORE" }, { status: 403 });
  }

  return {
    userId: user.id,
    userEmail: user.email ?? null,
    userRole: role,
    siteSlug: "gpt-store",
    chatId,
    isStaff,
  };
}

async function verifySubsExportAccess(chatId: string): Promise<ExportAccessContext | NextResponse> {
  const subsAdmin = createSubsStoreAdminClient();
  if (!subsAdmin) {
    return NextResponse.json({ error: "SPOTIFY STORE не подключён" }, { status: 503 });
  }

  const { data: thread, error: thErr } = await subsAdmin
    .from("chat_threads")
    .select("id, user_id")
    .eq("id", chatId)
    .maybeSingle();

  if (thErr || !thread?.id) {
    return NextResponse.json({ error: "Чат не найден" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user: gptUser },
  } = await supabase.auth.getUser();

  if (gptUser) {
    const role = await resolveServerRole(gptUser);
    if (role === "admin" || role === "operator") {
      const staffCtx = await requireSubsStaffContext();
      if (!(staffCtx instanceof NextResponse)) {
        return {
          userId: gptUser.id,
          userEmail: gptUser.email ?? null,
          userRole: role,
          siteSlug: "subs-store",
          chatId,
          isStaff: true,
        };
      }
    }
  }

  if (!isSubsPublicAuthConfigured()) {
    return NextResponse.json({ error: "Subs Auth не настроен" }, { status: 503 });
  }

  const subsAuth = await createSubsAuthServerClient();
  if (!subsAuth) {
    return NextResponse.json({ error: "Не удалось проверить доступ" }, { status: 503 });
  }

  const {
    data: { user: subsUser },
  } = await subsAuth.auth.getUser();

  if (!subsUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if ((thread as { user_id?: string | null }).user_id !== subsUser.id) {
    return NextResponse.json({ error: "Нет доступа к этому чату" }, { status: 403 });
  }

  return {
    userId: subsUser.id,
    userEmail: subsUser.email ?? null,
    userRole: "client",
    siteSlug: "subs-store",
    chatId,
    isStaff: false,
  };
}

export function storeDisplayName(siteSlug: SiteSlug): string {
  return getSiteBySlug(siteSlug).brandName;
}
