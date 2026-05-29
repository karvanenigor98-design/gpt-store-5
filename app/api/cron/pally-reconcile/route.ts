import { NextRequest, NextResponse } from "next/server";

import { reconcileUnpaidOrderPayment } from "@/lib/payments/reconcile-unpaid-order";
import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}` || req.headers.get("x-cron-secret") === secret;
}

/** Сверка «оплачен в Pally, но статус в БД не обновился». */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let checked = 0;
  let applied = 0;
  const details: string[] = [];

  const admin = createAdminClient();
  const { data: gptOrders } = await admin
    .from("orders")
    .select("id,status,price")
    .eq("status", "pending")
    .not("payment_id", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(30);

  for (const row of gptOrders ?? []) {
    checked += 1;
    const result = await reconcileUnpaidOrderPayment({
      siteSlug: "gpt-store",
      orderId: String(row.id),
    });
    if (result.ok && result.applied) {
      applied += 1;
      details.push(`gpt:${String(row.id).slice(0, 8)}`);
    }
  }

  const subs = createSubsStoreAdminClient();
  if (subs) {
    const { data: subsOrders } = await subs
      .from("orders")
      .select("id,status,payment_status")
      .eq("status", "awaiting_payment")
      .eq("payment_status", "pending")
      .not("payment_external_id", "is", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(30);

    for (const row of subsOrders ?? []) {
      checked += 1;
      const result = await reconcileUnpaidOrderPayment({
        siteSlug: "subs-store",
        orderId: String(row.id),
      });
      if (result.ok && result.applied) {
        applied += 1;
        details.push(`subs:${String(row.id).slice(0, 8)}`);
      }
    }
  }

  return NextResponse.json({ ok: true, checked, applied, details });
}
