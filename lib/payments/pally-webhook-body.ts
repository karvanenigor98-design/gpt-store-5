import type { NextRequest } from "next/server";

/** Нормализация полей Pally (JSON и form: Status, InvId, OutSum, SignatureValue). */
export function normalizePallyWebhookPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const pick = (...keys: string[]): unknown => {
    for (const key of keys) {
      if (raw[key] != null && String(raw[key]).trim() !== "") return raw[key];
    }
    const lower = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k.toLowerCase(), v]),
    );
    for (const key of keys) {
      const v = lower[key.toLowerCase()];
      if (v != null && String(v).trim() !== "") return v;
    }
    return undefined;
  };

  const status = pick("status", "Status", "payment_status", "PaymentStatus");
  const orderId = pick("order_id", "orderId", "OrderId", "InvId", "inv_id", "invid");
  const amount = pick("amount", "OutSum", "out_sum", "outsum", "sum", "Sum");
  const sign = pick("sign", "Sign", "SignatureValue", "signature", "signature_value");
  const paymentId = pick("payment_id", "PaymentId", "id", "transaction_id", "TrsId");
  const shopId = pick("shop_id", "shopId", "ShopId", "merchant_id", "MerchantId");

  return {
    ...raw,
    ...(status != null ? { status } : {}),
    ...(orderId != null ? { order_id: orderId } : {}),
    ...(amount != null ? { amount } : {}),
    ...(sign != null ? { sign } : {}),
    ...(paymentId != null ? { payment_id: paymentId } : {}),
    ...(shopId != null ? { shop_id: shopId } : {}),
  };
}

function parseKeyValueBody(rawText: string): Record<string, unknown> {
  const trimmed = rawText.trim();
  if (!trimmed) return {};

  const params = new URLSearchParams(trimmed);
  const out: Record<string, unknown> = {};
  for (const [k, v] of params.entries()) {
    out[k] = v;
  }
  return out;
}

/** Pally webhook: JSON или `Status=SUCCESS&InvId=...&OutSum=...`. */
export async function parsePallyWebhookRequestBody(
  request: NextRequest,
): Promise<Record<string, unknown>> {
  const rawText = await request.text();
  if (!rawText.trim()) return {};

  const trimmed = rawText.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const json = JSON.parse(trimmed) as Record<string, unknown>;
      return normalizePallyWebhookPayload(json);
    } catch {
      /* form fallback below */
    }
  }

  const form = parseKeyValueBody(trimmed);
  if (Object.keys(form).length > 0) {
    return normalizePallyWebhookPayload(form);
  }

  return normalizePallyWebhookPayload({ raw: trimmed });
}
