import { NextRequest, NextResponse } from "next/server";

import { gptOrderStatusLabelRu } from "@/lib/admin/gpt-order-status-labels";
import { subsOrderStatusLabelRu } from "@/lib/admin/subs-order-status-labels";
import { resolveServerRole } from "@/lib/auth/server-role";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

const STAGES = ["purchased", "waiting", "no_purchase", "needs_help", "other"] as const;

const GPT_INACTIVE = new Set(["expired", "failed", "refunded"]);
const SUBS_INACTIVE = new Set(["cancelled", "refund", "problem"]);

function canonicalEmail(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function deriveStageFromOrders(
  orders: { status: string }[],
  siteSlug: "gpt-store" | "subs-store",
): (typeof STAGES)[number] {
  if (!orders.length) return "no_purchase";
  if (siteSlug === "subs-store") {
    const hasActive = orders.some((o) => ["activated", "completed"].includes(o.status));
    if (hasActive) return "purchased";
    const waiting = orders.some((o) =>
      ["awaiting_payment", "processing", "awaiting_data", "awaiting_operator", "paid"].includes(
        o.status,
      ),
    );
    if (waiting) return "waiting";
    return "other";
  }
  const hasActive = orders.some((o) => o.status === "active");
  if (hasActive) return "purchased";
  const waiting = orders.some((o) =>
    ["pending", "paid", "activating", "waiting_client"].includes(o.status),
  );
  if (waiting) return "waiting";
  return "other";
}

function pickFocusOrder<T extends { status: string; created_at: string }>(
  list: T[],
  siteSlug: "gpt-store" | "subs-store",
): T | null {
  if (!list.length) return null;
  const inactive = siteSlug === "subs-store" ? SUBS_INACTIVE : GPT_INACTIVE;
  const open = list.find((o) => !inactive.has(o.status));
  return open ?? list[0] ?? null;
}

function resolveFocusOrder<T extends { id: string; status: string; created_at: string }>(
  list: T[],
  siteSlug: "gpt-store" | "subs-store",
  preferredOrderId?: string | null,
): T | null {
  const preferred = preferredOrderId?.trim();
  if (preferred) {
    const hit = list.find((o) => o.id === preferred);
    if (hit) return hit;
  }
  return pickFocusOrder(list, siteSlug);
}

function statusLabel(siteSlug: "gpt-store" | "subs-store", status: string): string {
  return siteSlug === "subs-store" ? subsOrderStatusLabelRu(status) : gptOrderStatusLabelRu(status);
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase() ?? "";
  const sessionId = req.nextUrl.searchParams.get("sessionId")?.trim() ?? "";
  const orderId = req.nextUrl.searchParams.get("orderId")?.trim() ?? "";
  const siteParam = req.nextUrl.searchParams.get("site");
  const siteSlug: "gpt-store" | "subs-store" =
    siteParam === "subs-store" ? "subs-store" : "gpt-store";

  if (!userId && !email && !sessionId && !orderId) {
    return NextResponse.json({ error: "Нужен userId, email, orderId или sessionId" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const role = await resolveServerRole(user);
  if (role !== "admin" && role !== "operator") {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  if (siteSlug === "subs-store") {
    const subs = createSubsStoreAdminClient();
    if (!subs) {
      return NextResponse.json({ error: "Subs Store не подключён" }, { status: 503 });
    }

    let list: {
      id: string;
      status: string;
      plan_id: string;
      price: number;
      created_at: string;
    }[] = [];

    if (orderId && !userId && !email) {
      const { data: singleOrder } = await subs
        .from("orders")
        .select("id, status, tariff_id, final_price, created_at, customer_email, account_email, user_id")
        .eq("id", orderId)
        .maybeSingle();
      if (singleOrder) {
        list = [
          {
            id: String(singleOrder.id),
            status: String(singleOrder.status ?? "awaiting_payment"),
            plan_id: String(singleOrder.tariff_id ?? "spotify"),
            price: Number(singleOrder.final_price ?? 0),
            created_at: String(singleOrder.created_at ?? new Date().toISOString()),
          },
        ];
        const orderEmail =
          (singleOrder.customer_email as string | null)?.trim().toLowerCase() ??
          (singleOrder.account_email as string | null)?.trim().toLowerCase() ??
          "";
        return NextResponse.json({
          profile: {
            id: (singleOrder.user_id as string | null) ?? `order:${orderId}`,
            email: orderEmail || null,
            username: null,
            telegram_id: null,
            telegram_username: null,
            created_at: new Date().toISOString(),
            last_seen: null,
            notes: null,
            tags: [],
            client_stage: null,
            role: "client",
          },
          site_slug: siteSlug,
          derived_stage: deriveStageFromOrders(list, siteSlug),
          effective_stage: deriveStageFromOrders(list, siteSlug),
          has_active_subscription: list.some((o) => ["activated", "completed"].includes(o.status)),
          focus_order: list[0] ?? null,
          active_order: list[0] ?? null,
          orders: list,
        });
      }
    }

    if (userId) {
      const { data: subsOrders } = await subs
        .from("orders")
        .select("id, status, tariff_id, final_price, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      list = (subsOrders ?? []).map((o) => ({
        id: String(o.id),
        status: String(o.status ?? "awaiting_payment"),
        plan_id: String(o.tariff_id ?? "spotify"),
        price: Number(o.final_price ?? 0),
        created_at: String(o.created_at ?? new Date().toISOString()),
      }));
    } else if (email) {
      const [{ data: byCustomer }, { data: byAccount }] = await Promise.all([
        subs
          .from("orders")
          .select("id, status, tariff_id, final_price, created_at")
          .ilike("customer_email", email)
          .order("created_at", { ascending: false })
          .limit(30),
        subs
          .from("orders")
          .select("id, status, tariff_id, final_price, created_at")
          .ilike("account_email", email)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      const byId = new Map<string, (typeof list)[number]>();
      for (const o of [...(byCustomer ?? []), ...(byAccount ?? [])]) {
        byId.set(String(o.id), {
          id: String(o.id),
          status: String(o.status ?? "awaiting_payment"),
          plan_id: String(o.tariff_id ?? "spotify"),
          price: Number(o.final_price ?? 0),
          created_at: String(o.created_at ?? new Date().toISOString()),
        });
      }
      list = [...byId.values()].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    } else {
      return NextResponse.json({
        profile: null,
        site_slug: siteSlug,
        derived_stage: "no_purchase",
        effective_stage: "no_purchase",
        has_active_subscription: false,
        focus_order: null,
        active_order: null,
        orders: [],
        hint: "Для Subs Store укажите userId или email клиента",
      });
    }

    const focusOrder = resolveFocusOrder(list, siteSlug, orderId);
    const derived = deriveStageFromOrders(list, siteSlug);
    const hasActive = list.some((o) => ["activated", "completed"].includes(o.status));

    return NextResponse.json({
      profile: userId || email
        ? {
            id: userId || email,
            email: email || null,
            username: null,
            telegram_id: null,
            telegram_username: null,
            created_at: new Date().toISOString(),
            last_seen: null,
            notes: null,
            tags: [],
            client_stage: null,
            role: "client",
          }
        : null,
      site_slug: siteSlug,
      derived_stage: derived,
      effective_stage: derived,
      has_active_subscription: hasActive,
      focus_order: focusOrder,
      active_order: focusOrder,
      orders: list,
    });
  }

  const admin = createAdminClient();
  const baseSelect =
    "id, email, username, telegram_id, telegram_username, role, created_at, last_seen, notes, tags, client_stage";
  let profile: {
    id: string;
    email: string | null;
    username: string | null;
    telegram_id: number | null;
    telegram_username: string | null;
    role: string | null;
    created_at: string;
    last_seen: string | null;
    notes: string | null;
    tags: string[] | null;
    client_stage: string | null;
  } | null = null;
  let pErr: Error | null = null;

  if (userId) {
    const byId = await admin.from("profiles").select(baseSelect).eq("id", userId).maybeSingle();
    profile = byId.data;
    pErr = byId.error;
  }

  if (!profile && email) {
    const byEmail = await admin.from("profiles").select(baseSelect).ilike("email", email).maybeSingle();
    profile = byEmail.data;
    pErr = pErr ?? byEmail.error;
  }

  if (!profile && sessionId) {
    const { data: sessionRow } = await admin
      .from("chat_sessions")
      .select("user_id")
      .eq("id", sessionId)
      .maybeSingle();
    if (sessionRow?.user_id) {
      const bySessionUser = await admin
        .from("profiles")
        .select(baseSelect)
        .eq("id", sessionRow.user_id)
        .maybeSingle();
      profile = bySessionUser.data;
      pErr = pErr ?? bySessionUser.error;
    }
  }

  if (!profile && email) {
    const localPart = email.split("@")[0] ?? "";
    if (localPart) {
      const { data: candidates } = await admin
        .from("profiles")
        .select(baseSelect)
        .ilike("email", `${localPart}%`)
        .limit(30);
      const wanted = canonicalEmail(email);
      profile =
        (candidates ?? []).find((p) => canonicalEmail(p.email) === wanted) ??
        (candidates ?? [])[0] ??
        null;
    }
  }

  if (!profile && sessionId) {
    const { data: lastClientMsg } = await admin
      .from("chat_messages")
      .select("sender_id")
      .eq("session_id", sessionId)
      .eq("sender_type", "client")
      .not("sender_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastClientMsg?.sender_id) {
      const byMsgSender = await admin
        .from("profiles")
        .select(baseSelect)
        .eq("id", lastClientMsg.sender_id)
        .maybeSingle();
      profile = byMsgSender.data;
      pErr = pErr ?? byMsgSender.error;
    }
  }

  if (pErr || !profile) {
    return NextResponse.json({
      profile: null,
      site_slug: siteSlug,
      derived_stage: "no_purchase",
      effective_stage: "no_purchase",
      has_active_subscription: false,
      focus_order: null,
      active_order: null,
      orders: [],
      hint: "Профиль не удалось связать с этим чатом",
    });
  }

  const { data: orders } = await admin
    .from("orders")
    .select("id, status, plan_id, price, created_at, payment_provider, activated_at, expires_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const list = (orders ?? []).map((o) => ({
    id: String(o.id),
    status: String(o.status),
    plan_id: String(o.plan_id),
    price: Number(o.price ?? 0),
    created_at: String(o.created_at),
  }));

  const focusOrder = resolveFocusOrder(list, siteSlug, orderId);
  const derived = deriveStageFromOrders(list, siteSlug);
  const stage =
    profile.client_stage && STAGES.includes(profile.client_stage as (typeof STAGES)[number])
      ? profile.client_stage
      : derived;

  return NextResponse.json({
    profile: {
      id: profile.id,
      email: profile.email,
      username: profile.username,
      telegram_id: profile.telegram_id ?? null,
      telegram_username: profile.telegram_username ?? null,
      created_at: profile.created_at,
      last_seen: profile.last_seen ?? null,
      notes: profile.notes,
      tags: profile.tags ?? [],
      client_stage: profile.client_stage,
      role: profile.role ?? "client",
    },
    site_slug: siteSlug,
    derived_stage: derived,
    effective_stage: stage,
    has_active_subscription: list.some((o) => o.status === "active"),
    focus_order: focusOrder,
    active_order: focusOrder,
    orders: list,
    status_label: focusOrder ? statusLabel(siteSlug, focusOrder.status) : null,
  });
}
