import crypto from "crypto";

import {
  fetchPallyBillStatus,
  mapPallyStatus,
  resolvePallyShopId,
  type PallyStoreSlug,
} from "@/lib/payments/pally";
import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

function md5hex(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex");
}

function signaturesMatch(received: string, expected: string): boolean {
  const r = received.trim().toLowerCase();
  const e = expected.trim().toLowerCase();
  if (!r || !e || r.length !== e.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(r), Buffer.from(e));
  } catch {
    return r === e;
  }
}

function collectPallySecrets(): string[] {
  const out: string[] = [];
  // Webhook Pally = MD5(OutSum:InvId:API_TOKEN) — тот же PALLY_SECRET_KEY, не отдельный webhook secret.
  for (const key of ["PALLY_SECRET_KEY", "PALLY_WEBHOOK_SECRET"] as const) {
    const value = process.env[key]?.trim();
    if (value) out.push(value);
  }
  return [...new Set(out)];
}

function pickField(body: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const direct = body[key];
    if (direct != null && String(direct).trim() !== "") return String(direct).trim();
  }
  const lower = Object.fromEntries(
    Object.entries(body).map(([k, v]) => [k.toLowerCase(), v]),
  );
  for (const key of keys) {
    const value = lower[key.toLowerCase()];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function orderIdFromBody(body: Record<string, unknown>): string {
  return pickField(body, "order_id", "orderId", "OrderId", "InvId", "inv_id", "invid");
}

function outSumFromBody(body: Record<string, unknown>): string {
  return pickField(body, "OutSum", "out_sum", "outsum", "amount", "sum", "Sum");
}

function shopIdFromBody(body: Record<string, unknown>): string {
  return pickField(body, "shop_id", "shopId", "ShopId", "merchant_id", "MerchantId");
}

function amountCandidates(body: Record<string, unknown>): string[] {
  const raw = outSumFromBody(body);
  const candidates = new Set<string>();
  if (raw) {
    candidates.add(raw);
    const normalized = raw.replace(",", ".");
    candidates.add(normalized);
    const num = Number(normalized);
    if (!Number.isNaN(num)) {
      candidates.add(String(num));
      if (Number.isInteger(num)) {
        candidates.add(String(Math.trunc(num)));
      }
      candidates.add(num.toFixed(2));
    }
  }
  const amount = body.amount;
  if (amount != null && String(amount).trim() !== "") {
    candidates.add(String(amount).trim());
  }
  return [...candidates];
}

function shopIdCandidates(body: Record<string, unknown>, site: PallyStoreSlug): string[] {
  const fromBody = shopIdFromBody(body);
  const fromEnv = resolvePallyShopId(site);
  const out = new Set<string>();
  if (fromBody) out.add(fromBody);
  if (fromEnv) out.add(fromEnv);
  return [...out];
}

function expectedSignatures(params: {
  shopId: string;
  orderId: string;
  amount: string;
  secret: string;
}): string[] {
  const { shopId, orderId, amount, secret } = params;
  const outSum = amount;
  const invId = orderId;
  const strings = [
    `${shopId}:${orderId}:${amount}:${secret}`,
    `${shopId}:${orderId}:${Number(amount)}:${secret}`,
    `${outSum}:${invId}:${secret}`,
    `${invId}:${outSum}:${secret}`,
    `${shopId}${orderId}${amount}${secret}`,
    `${amount}${orderId}${secret}`,
    `${secret}${amount}${orderId}`,
  ];
  return strings.map(md5hex);
}

function verifyRobokassaStyle(
  body: Record<string, unknown>,
  receivedSign: string,
): boolean {
  const orderId = orderIdFromBody(body);
  const outSum = outSumFromBody(body);
  if (!orderId || !outSum) return false;

  for (const secret of collectPallySecrets()) {
    const primary = md5hex(`${outSum}:${orderId}:${secret}`);
    if (signaturesMatch(receivedSign, primary)) return true;

    const normalizedSum = outSum.replace(",", ".");
    if (normalizedSum !== outSum) {
      const alt = md5hex(`${normalizedSum}:${orderId}:${secret}`);
      if (signaturesMatch(receivedSign, alt)) return true;
    }
  }

  return false;
}

function verifyWithSecrets(
  body: Record<string, unknown>,
  receivedSign: string,
  site: PallyStoreSlug,
): boolean {
  if (verifyRobokassaStyle(body, receivedSign)) return true;

  const orderId = orderIdFromBody(body);
  if (!orderId) return false;

  const amounts = amountCandidates(body);
  const shopIds = shopIdCandidates(body, site);
  const secrets = collectPallySecrets();
  if (!secrets.length) return false;

  const shopLoop = shopIds.length > 0 ? shopIds : [""];

  for (const shopId of shopLoop) {
    for (const amount of amounts.length ? amounts : [""]) {
      for (const secret of secrets) {
        for (const expected of expectedSignatures({ shopId, orderId, amount, secret })) {
          if (signaturesMatch(receivedSign, expected)) return true;
        }
      }
    }
  }

  return false;
}

function isPaidLikeWebhookStatus(body: Record<string, unknown>): boolean {
  const status = pickField(body, "status", "Status", "payment_status", "PaymentStatus").toLowerCase();
  return ["success", "paid", "completed", "1"].includes(status);
}

async function resolveOrderAmount(site: PallyStoreSlug, orderId: string): Promise<number | null> {
  if (site === "subs-store") {
    const subs = createSubsStoreAdminClient();
    if (!subs) return null;
    const { data } = await subs
      .from("orders")
      .select("final_price")
      .eq("id", orderId)
      .maybeSingle();
    return data ? Number(data.final_price) || null : null;
  }

  const admin = createAdminClient();
  const { data } = await admin.from("orders").select("price").eq("id", orderId).maybeSingle();
  return data ? Number(data.price) || null : null;
}

/** Если подпись не сошлась — подтверждаем оплату через Pally bill/status по order_id. */
export async function confirmPallyWebhookViaApi(
  body: Record<string, unknown>,
): Promise<boolean> {
  if (!isPaidLikeWebhookStatus(body)) return false;

  const orderId = orderIdFromBody(body);
  if (!orderId) return false;

  const webhookAmounts = amountCandidates(body)
    .map((value) => Number(value.replace(",", ".")))
    .filter((value) => !Number.isNaN(value) && value > 0);

  for (const site of ["gpt-store", "subs-store"] as const) {
    const dbAmount = await resolveOrderAmount(site, orderId);
    if (dbAmount == null && webhookAmounts.length === 0) continue;

    const amounts = new Set<number>();
    if (dbAmount != null && dbAmount > 0) amounts.add(dbAmount);
    for (const value of webhookAmounts) amounts.add(value);

    for (const amount of amounts) {
      const status = await fetchPallyBillStatus({ site, orderId, amount });
      if (status && mapPallyStatus(status) === "paid") return true;
    }
  }

  return false;
}

/** Проверка подписи webhook: GPT и Spotify shop_id (разные PALLY_SHOP_ID_*). */
export function verifyPallyWebhook(
  body: Record<string, unknown>,
  receivedSign: string,
): boolean {
  if (!receivedSign?.trim()) {
    if (process.env.PALLY_WEBHOOK_REQUIRE_SIGN === "true") return false;
    return true;
  }

  // Pally JSON webhook: OutSum + InvId + SignatureValue (без shop_id в теле).
  if (verifyRobokassaStyle(body, receivedSign)) return true;

  const hint = String(body.site_slug ?? body.site ?? "").toLowerCase();
  const sites: PallyStoreSlug[] =
    hint.includes("subs") || hint.includes("spotify")
      ? ["subs-store", "gpt-store"]
      : ["gpt-store", "subs-store"];

  return sites.some((site) => verifyWithSecrets(body, receivedSign, site));
}
