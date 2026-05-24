import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { SiteSlug } from "@/lib/sites";

export type UnpaidOrderRecipient = {
  orderId: string;
  email: string;
  planName: string;
  price: number;
  createdAt: string;
};

export type UnpaidCampaignPreview = {
  totalOrders: number;
  uniqueEmails: number;
  skippedNoEmail: number;
  skippedPaid: number;
  duplicateEmails: number;
  recipients: UnpaidOrderRecipient[];
};

function periodStart(period: string): Date | null {
  const now = Date.now();
  if (period === "1h") return new Date(now - 60 * 60_000);
  if (period === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "24h") return new Date(now - 24 * 60 * 60_000);
  if (period === "7d") return new Date(now - 7 * 24 * 60 * 60_000);
  return null;
}

export async function previewUnpaidOrderCampaign(params: {
  siteSlug: SiteSlug;
  period: string;
}): Promise<UnpaidCampaignPreview> {
  const since = periodStart(params.period);
  const recipients: UnpaidOrderRecipient[] = [];

  if (params.siteSlug === "subs-store") {
    const subs = createSubsStoreAdminClient();
    if (!subs) {
      return {
        totalOrders: 0,
        uniqueEmails: 0,
        skippedNoEmail: 0,
        skippedPaid: 0,
        duplicateEmails: 0,
        recipients: [],
      };
    }

    let q = subs
      .from("orders")
      .select("id,status,payment_status,customer_email,final_price,created_at,tariffs(title)")
      .eq("status", "awaiting_payment")
      .eq("payment_status", "pending")
      .order("created_at", { ascending: false })
      .limit(500);

    if (since) q = q.gte("created_at", since.toISOString());

    const { data } = await q;
    for (const row of data ?? []) {
      const email = (row.customer_email as string | null)?.trim().toLowerCase() ?? "";
      if (!email) continue;
      const tr = row.tariffs as { title?: string } | { title?: string }[] | null;
      const planName =
        Array.isArray(tr) ? tr[0]?.title
        : tr && typeof tr === "object" ? tr.title
        : "Spotify Premium";
      recipients.push({
        orderId: row.id as string,
        email,
        planName: planName ?? "Spotify Premium",
        price: Number(row.final_price ?? 0),
        createdAt: row.created_at as string,
      });
    }
  } else {
    const admin = createAdminClient();
    let q = admin
      .from("orders")
      .select("id,status,price,account_email,created_at,plan_id")
      .eq("status", "pending")
      .not("product", "ilike", "spotify%")
      .order("created_at", { ascending: false })
      .limit(500);

    if (since) q = q.gte("created_at", since.toISOString());

    const { data } = await q;
    for (const row of data ?? []) {
      const email = (row.account_email ?? "").trim().toLowerCase();
      if (!email) continue;
      recipients.push({
        orderId: row.id as string,
        email,
        planName: String(row.plan_id ?? "ChatGPT"),
        price: Number(row.price ?? 0),
        createdAt: row.created_at as string,
      });
    }
  }

  const seenEmails = new Set<string>();
  let duplicateEmails = 0;
  const deduped: UnpaidOrderRecipient[] = [];

  for (const r of recipients) {
    if (seenEmails.has(r.email)) {
      duplicateEmails += 1;
      continue;
    }
    seenEmails.add(r.email);
    deduped.push(r);
  }

  return {
    totalOrders: recipients.length,
    uniqueEmails: deduped.length,
    skippedNoEmail: 0,
    skippedPaid: 0,
    duplicateEmails,
    recipients: deduped,
  };
}
