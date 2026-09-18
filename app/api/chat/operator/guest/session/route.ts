import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateClientOperatorSession } from "@/lib/chat/operatorSession";
import { claimOrMergeGuestOperatorSession } from "@/lib/chat/merge-guest-session";
import { getSiteUUID } from "@/lib/admin/getSiteId";

export async function POST(req: NextRequest) {
  let providedSessionId: string | undefined;

  try {
    const body = (await req.json()) as { sessionId?: string };
    providedSessionId = body.sessionId;
  } catch {
    providedSessionId = undefined;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const gptSiteId = await getSiteUUID("gpt-store");

  if (providedSessionId && user) {
    const merged = await claimOrMergeGuestOperatorSession(
      supabaseAdmin,
      providedSessionId,
      user.id,
      gptSiteId,
    );
    if (merged) {
      return NextResponse.json({ sessionId: merged });
    }
  }

  if (providedSessionId && !user) {
    let existingQuery = supabaseAdmin
      .from("chat_sessions")
      .select("id, user_id")
      .eq("id", providedSessionId)
      .eq("type", "operator")
      .eq("status", "open")
      .is("user_id", null)
      .limit(1);
    if (gptSiteId) {
      existingQuery = existingQuery.or(`site_id.eq.${gptSiteId},site_id.is.null`);
    }
    const { data: existing, error: selectError } = await existingQuery.maybeSingle();
    if (!selectError && existing?.id) {
      return NextResponse.json({ sessionId: existing.id });
    }
  }

  if (user) {
    let session = await getOrCreateClientOperatorSession(supabaseAdmin, user.id, "gpt-store");
    if (!session?.id) {
      await supabaseAdmin.from("profiles").upsert(
        {
          id: user.id,
          email: user.email ?? null,
          role: "client",
        },
        { onConflict: "id" },
      );
      session = await getOrCreateClientOperatorSession(supabaseAdmin, user.id, "gpt-store");
    }
    if (!session?.id) {
      return NextResponse.json({ error: "Не удалось создать чат с оператором" }, { status: 500 });
    }
    return NextResponse.json({ sessionId: session.id });
  }

  const { data, error } = await supabaseAdmin
    .from("chat_sessions")
    .insert({
      user_id: null,
      type: "operator",
      status: "open",
      ...(gptSiteId ? { site_id: gptSiteId } : {}),
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Не удалось создать чат с оператором" }, { status: 500 });
  }

  return NextResponse.json({ sessionId: data.id });
}
