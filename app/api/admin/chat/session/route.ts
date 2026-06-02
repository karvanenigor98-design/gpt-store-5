import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveServerRole } from "@/lib/auth/server-role";
import { pickCanonicalOperatorSession } from "@/lib/chat/operatorSession";
import { getOrCreateSubsStaffSupportThread } from "@/lib/chat/subs-support-thread";
import { getSiteUUID } from "@/lib/admin/getSiteId";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { Database } from "@/types/database";

function normalizeStaffSiteSlug(raw: string | undefined): "gpt-store" | "subs-store" | undefined {
  return raw === "subs-store" || raw === "gpt-store" ? raw : undefined;
}

export async function POST(req: NextRequest) {
  let body: { userId?: string; email?: string; orderId?: string; site?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный формат запроса" }, { status: 400 });
  }

  const explicitUserId = body.userId?.trim();
  const email = body.email?.trim().toLowerCase() ?? "";
  const orderId = body.orderId?.trim() ?? "";

  const siteSlug = normalizeStaffSiteSlug(body.site?.trim());

  if (siteSlug === "subs-store") {
    const subsAdmin = createSubsStoreAdminClient();
    if (!subsAdmin) {
      return NextResponse.json(
        { error: "Subs Supabase админ недоступен" },
        { status: 503 },
      );
    }
    let resolvedSubsUserId = explicitUserId;
    if (!resolvedSubsUserId && email) {
      const [{ data: profile }, { data: byCustomer }, { data: byAccount }] = await Promise.all([
        subsAdmin.from("profiles").select("id").ilike("email", email).limit(1).maybeSingle(),
        subsAdmin
          .from("orders")
          .select("user_id,created_at")
          .ilike("customer_email", email)
          .not("user_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        subsAdmin
          .from("orders")
          .select("user_id,created_at")
          .ilike("account_email", email)
          .not("user_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      resolvedSubsUserId =
        (profile?.id as string | undefined) ??
        ((byCustomer?.user_id as string | null) ?? undefined) ??
        ((byAccount?.user_id as string | null) ?? undefined);
    }
    if (!resolvedSubsUserId && !orderId) {
      if (email) {
        const [{ data: byCustomer }, { data: byAccount }] = await Promise.all([
          subsAdmin
            .from("orders")
            .select("id, created_at")
            .ilike("customer_email", email)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          subsAdmin
            .from("orders")
            .select("id, created_at")
            .ilike("account_email", email)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        const latestOrderId =
          (byCustomer?.id as string | undefined) ?? (byAccount?.id as string | undefined);
        if (latestOrderId) {
          const threadByLatest = await getOrCreateSubsStaffSupportThread(subsAdmin, {
            orderId: latestOrderId,
          });
          if (threadByLatest?.id) {
            return NextResponse.json({ sessionId: threadByLatest.id, threadId: threadByLatest.id });
          }
        }
      }
      return NextResponse.json(
        { error: "Не удалось определить клиента для чата (нужен userId, orderId или email с заказом)." },
        { status: 400 },
      );
    }

    const thread = await getOrCreateSubsStaffSupportThread(subsAdmin, {
      userId: resolvedSubsUserId,
      orderId: orderId || undefined,
    });
    if (!thread?.id) {
      return NextResponse.json({ error: "Не удалось создать тред поддержки" }, { status: 500 });
    }
    return NextResponse.json({ sessionId: thread.id, threadId: thread.id });
  }

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

  const admin = createAdminClient();
  let resolvedUserId = explicitUserId;
  if (!resolvedUserId && email) {
    const byEmail = await admin.from("profiles").select("id").ilike("email", email).limit(1).maybeSingle();
    resolvedUserId = byEmail.data?.id ?? undefined;
  }
  if (!resolvedUserId && email) {
    const siteUuid = siteSlug ? await getSiteUUID(siteSlug) : null;
    let byOrder = admin
      .from("orders")
      .select("user_id, created_at")
      .ilike("account_email", email)
      .not("user_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (siteUuid) byOrder = byOrder.eq("site_id", siteUuid);
    const byOrderRes = await byOrder.maybeSingle();
    resolvedUserId = byOrderRes.data?.user_id ?? undefined;
  }
  if (!resolvedUserId) {
    return NextResponse.json(
      { error: "Не удалось определить клиента для чата (нужен userId или email связанный с профилем/заказом)." },
      { status: 400 },
    );
  }

  const existing = await pickCanonicalOperatorSession(admin, resolvedUserId, siteSlug);

  if (existing?.id) {
    if (existing.status !== "open") {
      await admin
        .from("chat_sessions")
        .update({ status: "open" })
        .eq("id", existing.id);
    }
    return NextResponse.json({ sessionId: existing.id });
  }

  const siteUuid = siteSlug ? await getSiteUUID(siteSlug) : null;
  const insertRow: Database["public"]["Tables"]["chat_sessions"]["Insert"] = {
    user_id: resolvedUserId,
    type: "operator",
    status: "open",
    ...(siteUuid ? { site_id: siteUuid } : {}),
  };

  const { data: created, error } = await admin
    .from("chat_sessions")
    .insert(insertRow)
    .select("id")
    .single();

  if (error || !created?.id) {
    return NextResponse.json({ error: "Не удалось создать сессию" }, { status: 500 });
  }

  return NextResponse.json({ sessionId: created.id });
}

