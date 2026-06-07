import {
  inferDurationMonthsFromText,
  resolveOrderSubscriptionExpiresAt,
} from "@/lib/admin/admin-subscription-label";

export type AdminClientOrderAgg = {
  user_id: string | null;
  status: string;
  plan_id?: string | null;
  product?: string | null;
  plan_name?: string | null;
  id?: string;
  planTitle?: string | null;
  tariff_id?: string | null;
  account_email?: string | null;
  activated_at?: string | null;
  expires_at?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  durationMonths?: number | null;
};

const SUBS_ACTIVE_STATUSES = new Set(["activated", "completed", "processing"]);
const GPT_ACTIVE_STATUSES = new Set(["active", "activating"]);

const SUBS_STATUS_RANK: Record<string, number> = {
  activated: 0,
  completed: 0,
  processing: 1,
};

const GPT_STATUS_RANK: Record<string, number> = {
  active: 0,
  activating: 1,
};

function orderRecencyMs(order: AdminClientOrderAgg): number {
  const iso = resolveOrderSubscriptionExpiresAt({
    expires_at: order.expires_at,
    activated_at: order.activated_at,
    paid_at: order.paid_at,
    created_at: order.created_at,
    durationMonths:
      order.durationMonths ??
      inferDurationMonthsFromText(order.planTitle) ??
      inferDurationMonthsFromText(order.plan_name),
  });
  if (iso) return new Date(iso).getTime();
  return Math.max(
    order.activated_at ? new Date(order.activated_at).getTime() : 0,
    order.paid_at ? new Date(order.paid_at).getTime() : 0,
    order.created_at ? new Date(order.created_at).getTime() : 0,
  );
}

export function pickAdminActiveOrder(
  orders: AdminClientOrderAgg[],
  siteSlug: "gpt-store" | "subs-store",
): AdminClientOrderAgg | undefined {
  const allowed = siteSlug === "subs-store" ? SUBS_ACTIVE_STATUSES : GPT_ACTIVE_STATUSES;
  const rank = siteSlug === "subs-store" ? SUBS_STATUS_RANK : GPT_STATUS_RANK;

  let best: AdminClientOrderAgg | undefined;
  for (const order of orders) {
    if (!allowed.has(order.status)) continue;
    if (!best) {
      best = order;
      continue;
    }
    const rA = rank[order.status] ?? 9;
    const rB = rank[best.status] ?? 9;
    if (rA < rB) {
      best = order;
      continue;
    }
    if (rA === rB && orderRecencyMs(order) > orderRecencyMs(best)) {
      best = order;
    }
  }
  return best;
}

export function buildAdminOrdersByUserId(
  orders: AdminClientOrderAgg[],
  clients: { id: string; email: string | null }[],
): Map<string, AdminClientOrderAgg[]> {
  const byUser = new Map<string, AdminClientOrderAgg[]>();
  const emailToId = new Map<string, string>();
  for (const c of clients) {
    const email = c.email?.trim().toLowerCase();
    if (email) emailToId.set(email, c.id);
  }

  for (const order of orders) {
    let userId = order.user_id ? String(order.user_id) : null;
    if (!userId) {
      const email = order.account_email?.trim().toLowerCase();
      if (email) userId = emailToId.get(email) ?? null;
    }
    if (!userId) continue;
    const arr = byUser.get(userId) ?? [];
    arr.push(order);
    byUser.set(userId, arr);
  }

  return byUser;
}

export function subsClientHasPaidOrder(orders: AdminClientOrderAgg[]): boolean {
  return orders.some((o) =>
    ["paid", "processing", "awaiting_data", "activated", "completed"].includes(o.status),
  );
}

export function gptClientHasPaidOrder(orders: AdminClientOrderAgg[]): boolean {
  return orders.some((o) => ["paid", "activating", "active", "waiting_client"].includes(o.status));
}
