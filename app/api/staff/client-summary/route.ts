import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { gptOrderStatusLabelRu } from "@/lib/admin/gpt-order-status-labels";
import { resolveStaffFocusOrder } from "@/lib/admin/resolve-staff-focus-order";
import { formatSubsTariffDisplayLabel } from "@/lib/admin/subs-tariff-display-label";
import { subsOrderStatusLabelRu } from "@/lib/admin/subs-order-status-labels";
import { getSiteUUID } from "@/lib/admin/getSiteId";
import { resolveServerRole } from "@/lib/auth/server-role";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { countLoyaltyCompletedOrders, getBonusTier } from "@/lib/loyalty/tier";

const STAGES = ["purchased", "waiting", "no_purchase", "needs_help", "other"] as const;

type StaffOrderRow = {
  id: string;
  status: string;
  plan_id: string;
  price: number;
  created_at: string;
  payment_status: string | null;
  paid_at: string | null;
  plan_title: string;
};

const SUBS_ORDER_SELECT =
  "id, status, payment_status, tariff_id, final_price, created_at, paid_at, customer_email, account_email, user_id";

function mapSubsOrderRow(o: {
  id: unknown;
  status?: unknown;
  payment_status?: unknown;
  tariff_id?: unknown;
  final_price?: unknown;
  created_at?: unknown;
  paid_at?: unknown;
}): StaffOrderRow {
  const tariffId = o.tariff_id != null ? String(o.tariff_id) : "spotify";
  return {
    id: String(o.id),
    status: String(o.status ?? "awaiting_payment"),
    plan_id: tariffId,
    price: Number(o.final_price ?? 0),
    created_at: String(o.created_at ?? new Date().toISOString()),
    payment_status: o.payment_status != null ? String(o.payment_status) : null,
    paid_at: o.paid_at != null ? String(o.paid_at) : null,
    plan_title: tariffId,
  };
}

async function attachSubsTariffTitles(
  subs: SupabaseClient,
  list: StaffOrderRow[],
): Promise<StaffOrderRow[]> {
  const tariffIds = [...new Set(list.map((o) => o.plan_id).filter((id) => id && id !== "spotify"))];
  if (!tariffIds.length) return list;
  const { data: tariffs } = await subs
    .from("tariffs")
    .select("id, title, slug, category, duration_months")
    .in("id", tariffIds);
  const titleById = new Map<string, string>();
  for (const t of tariffs ?? []) {
    titleById.set(String(t.id), formatSubsTariffDisplayLabel(t));
  }
  return list.map((o) => ({
    ...o,
    plan_title: titleById.get(o.plan_id) ?? o.plan_title,
  }));
}

function loyaltyMeta(
  list: { status: string }[],
  siteSlug: "gpt-store" | "subs-store",
): { loyalty_completed_orders: number; loyalty_tier: string } {
  const completed = countLoyaltyCompletedOrders(list, siteSlug);
  return {
    loyalty_completed_orders: completed,
    loyalty_tier: getBonusTier(completed).name,
  };
}

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

    let list: StaffOrderRow[] = [];

    if (orderId && !userId && !email) {
      const { data: singleOrder } = await subs
        .from("orders")
        .select(SUBS_ORDER_SELECT)
        .eq("id", orderId)
        .maybeSingle();
      if (singleOrder) {
        list = await attachSubsTariffTitles(subs, [mapSubsOrderRow(singleOrder)]);
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
          ...loyaltyMeta(list, siteSlug),
          has_active_subscription: list.some((o) => ["activated", "completed"].includes(o.status)),
          focus_order: list[0] ?? null,
          active_order: list[0] ?? null,
          orders: list,
          status_label: list[0] ? statusLabel(siteSlug, list[0].status) : null,
        });
      }
    }

    if (userId) {
      const { data: subsOrders } = await subs
        .from("orders")
        .select(SUBS_ORDER_SELECT)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      list = await attachSubsTariffTitles(subs, (subsOrders ?? []).map(mapSubsOrderRow));
    } else if (email) {
      const [{ data: byCustomer }, { data: byAccount }] = await Promise.all([
        subs
          .from("orders")
          .select(SUBS_ORDER_SELECT)
          .ilike("customer_email", email)
          .order("created_at", { ascending: false })
          .limit(30),
        subs
          .from("orders")
          .select(SUBS_ORDER_SELECT)
          .ilike("account_email", email)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      const byId = new Map<string, StaffOrderRow>();
      for (const o of [...(byCustomer ?? []), ...(byAccount ?? [])]) {
        byId.set(String(o.id), mapSubsOrderRow(o));
      }
      list = await attachSubsTariffTitles(
        subs,
        [...byId.values()].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      );
    } else {
      return NextResponse.json({
        profile: null,
        site_slug: siteSlug,
        derived_stage: "no_purchase",
        effective_stage: "no_purchase",
        ...loyaltyMeta([], siteSlug),
        has_active_subscription: false,
        focus_order: null,
        active_order: null,
        orders: [],
        hint: "Для Subs Store укажите userId или email клиента",
      });
    }

    const focusOrder = resolveStaffFocusOrder(list, siteSlug, orderId);
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
      ...loyaltyMeta(list, siteSlug),
      has_active_subscription: hasActive,
      focus_order: focusOrder,
      active_order: focusOrder,
      orders: list,
      status_label: focusOrder ? statusLabel(siteSlug, focusOrder.status) : null,
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
      ...loyaltyMeta([], siteSlug),
      has_active_subscription: false,
      focus_order: null,
      active_order: null,
      orders: [],
      hint: "Профиль не удалось связать с этим чатом",
    });
  }

  const gptSiteId = await getSiteUUID("gpt-store");
  let gptOrdersQuery = admin
    .from("orders")
    .select("id, status, plan_id, price, created_at, payment_provider, activated_at, expires_at")
    .eq("user_id", profile.id)
    .not("product", "ilike", "spotify%")
    .order("created_at", { ascending: false })
    .limit(30);
  if (gptSiteId) {
    gptOrdersQuery = gptOrdersQuery.or(`site_id.eq.${gptSiteId},site_id.is.null`);
  }
  const { data: orders } = await gptOrdersQuery;
  const byId = new Map<string, Record<string, unknown>>();
  for (const o of orders ?? []) {
    byId.set(String(o.id), o as Record<string, unknown>);
  }
  const profileEmail = (profile.email ?? "").trim().toLowerCase();
  if (profileEmail) {
    let emailQuery = admin
      .from("orders")
      .select("id, status, plan_id, price, created_at, payment_provider, activated_at, expires_at")
      .eq("account_email", profileEmail)
      .not("product", "ilike", "spotify%")
      .order("created_at", { ascending: false })
      .limit(30);
    if (gptSiteId) {
      emailQuery = emailQuery.or(`site_id.eq.${gptSiteId},site_id.is.null`);
    }
    const { data: byEmail } = await emailQuery;
    for (const o of byEmail ?? []) {
      byId.set(String(o.id), o as Record<string, unknown>);
    }
  }
  const mergedOrders = [...byId.values()].sort(
    (a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime(),
  );

  const list: StaffOrderRow[] = mergedOrders.map((o) => ({
    id: String(o.id),
    status: String(o.status ?? ""),
    plan_id: String(o.plan_id ?? ""),
    price: Number(o.price ?? 0),
    created_at: String(o.created_at ?? ""),
    payment_status: null,
    paid_at: null,
    plan_title: String(o.plan_id ?? ""),
  }));

  const focusOrder = resolveStaffFocusOrder(list, siteSlug, orderId);
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
    ...loyaltyMeta(list, siteSlug),
    has_active_subscription: list.some((o) => o.status === "active"),
    focus_order: focusOrder,
    active_order: focusOrder,
    orders: list,
    status_label: focusOrder ? statusLabel(siteSlug, focusOrder.status) : null,
  });
}
