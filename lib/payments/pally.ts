import crypto from "crypto";

import { detectEgressIp, pallyHttpPost } from "@/lib/payments/pally-http";

const PALLY_REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_PALLY_API_URL = "https://pally.info/api/v1";

/** Частая ошибка в Vercel: PALLY_API_URL=https://api.pally.info/v1 — хост не резолвится. */
export function normalizePallyApiUrl(raw?: string): string {
  const trimmed = (raw ?? DEFAULT_PALLY_API_URL).trim().replace(/\/$/, "");
  if (!trimmed) return DEFAULT_PALLY_API_URL;

  if (/api\.pally\.info/i.test(trimmed)) {
    return DEFAULT_PALLY_API_URL;
  }

  try {
    const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (u.hostname === "pally.info" && !u.pathname.startsWith("/api")) {
      return DEFAULT_PALLY_API_URL;
    }
    return `${u.origin}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return DEFAULT_PALLY_API_URL;
  }
}

function pallyApiUrlCandidates(): string[] {
  const primary = normalizePallyApiUrl(process.env.PALLY_API_URL);
  const urls = [primary];
  if (primary !== DEFAULT_PALLY_API_URL) urls.push(DEFAULT_PALLY_API_URL);
  return urls;
}

export type PallyStoreSlug = "gpt-store" | "subs-store";

/** GPT: PALLY_SHOP_ID или PALLY_SHOP_ID_GPT. Spotify: PALLY_SHOP_ID_SUBS (fallback — PALLY_SHOP_ID). */
export function resolvePallyShopId(site: PallyStoreSlug = "gpt-store"): string {
  if (site === "subs-store") {
    return (
      process.env.PALLY_SHOP_ID_SUBS?.trim() ||
      process.env.PALLY_SHOP_ID_SPOTIFY?.trim() ||
      ""
    );
  }
  return (
    process.env.PALLY_SHOP_ID?.trim() ||
    process.env.PALLY_SHOP_ID_GPT?.trim() ||
    ""
  );
}

function getPallyConfig(site: PallyStoreSlug = "gpt-store") {
  return {
    shopId: resolvePallyShopId(site),
    secretKey: process.env.PALLY_SECRET_KEY ?? "",
    apiUrls: pallyApiUrlCandidates(),
    testMode: process.env.PALLY_TEST_MODE === "true",
  };
}

/** URL success/fail как в кабинете Pally (без ?order= — иначе api:error.url_not_allowed). */
export function buildPallyRedirectUrls(
  appUrl: string,
  site: PallyStoreSlug = "gpt-store",
): { successUrl: string; failUrl: string } {
  const base = appUrl.replace(/\/$/, "");
  if (site === "subs-store") {
    return {
      successUrl: `${base}/checkout/success?site=subs-store`,
      failUrl: `${base}/checkout/fail?site=subs-store`,
    };
  }
  return {
    successUrl: `${base}/checkout/success`,
    failUrl: `${base}/checkout/fail`,
  };
}

export interface CreatePallyPaymentParams {
  orderId: string;
  amount: number;
  description: string;
  webhookUrl: string;
  /** Должны совпадать с «Ссылки» в кабинете Pally для этого shop_id. */
  successUrl: string;
  failUrl: string;
  customerEmail?: string;
  /** Какой магазин Pally (разные shop_id, один API-токен). */
  site?: PallyStoreSlug;
}

export interface PallyPaymentResult {
  paymentId: string;
  paymentUrl: string;
  status: string;
}

function buildSign(shopId: string, secretKey: string, orderId: string, amount: number): string {
  const signString = `${shopId}:${orderId}:${amount}:${secretKey}`;
  return crypto.createHash("md5").update(signString).digest("hex");
}

function resolvePaymentUrl(data: Record<string, unknown>): string {
  const nested =
    data.data && typeof data.data === "object" && !Array.isArray(data.data)
      ? (data.data as Record<string, unknown>)
      : null;

  const candidates = [
    data.link_url,
    data.link_page_url,
    data.payment_url,
    data.url,
    data.redirect_url,
    data.link,
    data.bill_url,
    nested?.link_url,
    nested?.link_page_url,
    nested?.payment_url,
    nested?.url,
    nested?.link,
    nested?.bill_url,
    nested?.redirect_url,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.startsWith("http")) return value;
  }

  return "";
}

function extractDeniedIp(data: Record<string, unknown>): string | null {
  const errors = data.errors;
  if (errors && typeof errors === "object" && !Array.isArray(errors)) {
    const ip = (errors as Record<string, unknown>).ip;
    if (typeof ip === "string" && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip;
  }
  const msg = String(data.message ?? "");
  const m = msg.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/);
  return m?.[1] ?? null;
}

async function formatPallyError(
  data: Record<string, unknown>,
  status: number,
): Promise<string> {
  const message = String(data.message ?? data.error ?? "").trim();
  if (message.includes("ip_access_denied")) {
    const deniedIp = extractDeniedIp(data) ?? (await detectEgressIp());
    const relayUrl = process.env.PALLY_RELAY_URL?.trim();
    const relayHint = relayUrl
      ? ` Relay (${relayUrl}) недоступен или не задеплоен — см. tools/pally-relay/setup-vps-cloudflared.sh`
      : " Настройте PALLY_RELAY_URL (tools/pally-relay/setup-vps-cloudflared.sh) или добавьте IP в Pally whitelist.";
    const ipHint = deniedIp ? ` IP для whitelist: ${deniedIp}.` : "";
    return "Pally отклонил запрос: IP сервера не в белом списке." + ipHint + relayHint;
  }
  if (message.includes("url_not_allowed")) {
    return (
      "Pally: URL оплаты не совпадает с настройками магазина (url_not_allowed). " +
      "В кабинете Pally → магазин → «Ссылки» укажите те же success/fail/webhook, что в docs/PALLY-MANUAL-ONLY.md " +
      "(без лишних ?order= в Success/Fail)."
    );
  }
  if (message) return `Pally: ${message}`;
  return `Pally API ошибка (HTTP ${status})`;
}

async function postBillCreate(
  apiUrl: string,
  shopId: string,
  secretKey: string,
  body: Record<string, unknown>,
): Promise<{ response: Response; data: Record<string, unknown>; endpoint: string }> {
  const endpoint = `${apiUrl.replace(/\/$/, "")}/bill/create`;
  const response = await pallyHttpPost(apiUrl, "/bill/create", {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${secretKey}`,
      "User-Agent": "GPT-STORE/1.0",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Pally API: неожиданный ответ (${response.status})`);
  }

  return { response, data, endpoint };
}

export async function createPallyPayment(
  params: CreatePallyPaymentParams,
): Promise<PallyPaymentResult> {
  const site = params.site ?? "gpt-store";
  const config = getPallyConfig(site);
  if (!config.shopId || !config.secretKey) {
    const shopHint =
      site === "subs-store"
        ? "PALLY_SHOP_ID_SUBS (Spotify) и PALLY_SECRET_KEY"
        : "PALLY_SHOP_ID (GPT) и PALLY_SECRET_KEY";
    throw new Error(`Pally не настроен: добавьте ${shopHint} в переменные окружения`);
  }

  const sign = buildSign(config.shopId, config.secretKey, params.orderId, params.amount);

  const body: Record<string, unknown> = {
    shop_id: config.shopId,
    order_id: params.orderId,
    amount: params.amount,
    currency: "RUB",
    desc: params.description,
    success_url: params.successUrl,
    fail_url: params.failUrl,
    webhook_url: params.webhookUrl,
    result_url: params.webhookUrl,
    email: params.customerEmail,
    sign,
    test: config.testMode ? 1 : 0,
    site_slug: site,
    site: site,
  };

  const networkErrors: string[] = [];
  let lastApiError: string | null = null;

  for (const apiUrl of config.apiUrls) {
    try {
      const { response, data, endpoint } = await postBillCreate(
        apiUrl,
        config.shopId,
        config.secretKey,
        body,
      );

      const paymentUrl = resolvePaymentUrl(data);
      const successFlag = data.success;
      const success =
        successFlag === true ||
        successFlag === "true" ||
        successFlag === 1 ||
        successFlag === "1" ||
        Boolean(paymentUrl);

      if (!response.ok || !success || !paymentUrl) {
        lastApiError = await formatPallyError(data, response.status);
        continue;
      }

      const nested =
        data.data && typeof data.data === "object" && !Array.isArray(data.data)
          ? (data.data as Record<string, unknown>)
          : null;

      return {
        paymentId: String(
          data.payment_id ?? data.id ?? nested?.payment_id ?? nested?.id ?? params.orderId,
        ),
        paymentUrl,
        status: String(data.status ?? nested?.status ?? "pending"),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const cause =
        err instanceof Error && err.cause && typeof err.cause === "object" && "code" in err.cause
          ? String((err.cause as { code?: string }).code ?? "")
          : "";
      if (cause === "ENOTFOUND" || /fetch failed|timeout|ECONNREFUSED/i.test(message)) {
        networkErrors.push(`${apiUrl}/bill/create`);
        continue;
      }
      if (message.startsWith("Pally API:") || message.startsWith("Pally:")) {
        lastApiError = message;
        continue;
      }
      throw err instanceof Error ? err : new Error("Ошибка сети при обращении к Pally");
    }
  }

  if (lastApiError) throw new Error(lastApiError);

  throw new Error(
    `Не удалось связаться с Pally (${networkErrors.join(" → ")}). ` +
      `В Vercel укажите PALLY_API_URL=${DEFAULT_PALLY_API_URL} (не api.pally.info).`,
  );
}

function verifyPallyWebhookForShop(
  body: Record<string, unknown>,
  receivedSign: string,
  site: PallyStoreSlug,
): boolean {
  const { shopId, secretKey } = getPallyConfig(site);
  if (!shopId || !secretKey || !receivedSign) return false;

  const orderId = String(body.order_id ?? body.orderId ?? "");
  const amount = Number(body.amount ?? 0);
  if (!orderId) return false;

  const signString = `${shopId}:${orderId}:${amount}:${secretKey}`;
  const expectedSign = crypto.createHash("md5").update(signString).digest("hex");

  if (receivedSign.length !== expectedSign.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(receivedSign), Buffer.from(expectedSign));
  } catch {
    return receivedSign === expectedSign;
  }
}

/** Проверка подписи webhook: GPT и Spotify shop_id (разные PALLY_SHOP_ID_*). */
export function verifyPallyWebhook(
  body: Record<string, unknown>,
  receivedSign: string,
): boolean {
  if (!receivedSign) return true;

  const hint = String(body.site_slug ?? body.site ?? "").toLowerCase();
  const sites: PallyStoreSlug[] =
    hint.includes("subs") || hint.includes("spotify")
      ? ["subs-store", "gpt-store"]
      : ["gpt-store", "subs-store"];

  return sites.some((site) => verifyPallyWebhookForShop(body, receivedSign, site));
}

async function postPallyJson(
  apiUrl: string,
  path: string,
  secretKey: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const response = await pallyHttpPost(apiUrl, path, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${secretKey}`,
      "User-Agent": "GPT-STORE/1.0",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    return { ok: response.ok, data };
  } catch {
    return { ok: false, data: {} };
  }
}

/** Статус счёта в Pally (fallback, если webhook не дошёл). */
export async function fetchPallyBillStatus(params: {
  site: PallyStoreSlug;
  orderId: string;
  amount: number;
}): Promise<string | null> {
  const config = getPallyConfig(params.site);
  if (!config.shopId || !config.secretKey) return null;

  const sign = buildSign(config.shopId, config.secretKey, params.orderId, params.amount);
  const payload = {
    shop_id: config.shopId,
    order_id: params.orderId,
    amount: params.amount,
    sign,
  };

  for (const apiUrl of config.apiUrls) {
    for (const path of ["/bill/status", "/bill/info"]) {
      const { ok, data } = await postPallyJson(apiUrl, path, config.secretKey, payload);
      if (!ok) continue;
      const raw = String(data.status ?? data.payment_status ?? "").toLowerCase();
      if (raw) return raw;
      const nested =
        data.data && typeof data.data === "object" && !Array.isArray(data.data)
          ? (data.data as Record<string, unknown>)
          : null;
      if (nested?.status) return String(nested.status).toLowerCase();
    }
  }

  return null;
}

export function mapPallyStatus(pallyStatus: string): string {
  const map: Record<string, string> = {
    paid: "paid",
    success: "paid",
    completed: "paid",
    1: "paid",
    failed: "failed",
    cancelled: "failed",
    cancel: "failed",
    refunded: "refunded",
    pending: "pending",
    created: "pending",
    0: "pending",
  };
  return map[String(pallyStatus).toLowerCase()] ?? "pending";
}
