import crypto from "crypto";

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

function getPallyConfig() {
  return {
    shopId: process.env.PALLY_SHOP_ID ?? "",
    secretKey: process.env.PALLY_SECRET_KEY ?? "",
    apiUrls: pallyApiUrlCandidates(),
    testMode: process.env.PALLY_TEST_MODE === "true",
  };
}

export interface CreatePallyPaymentParams {
  orderId: string;
  amount: number;
  description: string;
  returnUrl: string;
  webhookUrl: string;
  customerEmail?: string;
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
    data.payment_url,
    data.url,
    data.redirect_url,
    data.link,
    data.bill_url,
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

function formatPallyError(data: Record<string, unknown>, status: number): string {
  const message = String(data.message ?? data.error ?? "").trim();
  if (message.includes("ip_access_denied")) {
    return (
      "Pally отклонил запрос: IP сервера Vercel не в белом списке. " +
      "В кабинете Pally → настройки магазина отключите фильтр по IP или добавьте Static IPs Vercel (регион fra1)."
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
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${secretKey}`,
      "User-Agent": "GPT-STORE/1.0",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(PALLY_REQUEST_TIMEOUT_MS),
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
  const config = getPallyConfig();
  if (!config.shopId || !config.secretKey) {
    throw new Error("Pally не настроен: добавьте PALLY_SHOP_ID и PALLY_SECRET_KEY в переменные окружения");
  }

  const sign = buildSign(config.shopId, config.secretKey, params.orderId, params.amount);

  const body = {
    shop_id: config.shopId,
    order_id: params.orderId,
    amount: params.amount,
    currency: "RUB",
    desc: params.description,
    success_url: `${params.returnUrl}?orderId=${params.orderId}`,
    fail_url: `${params.returnUrl.replace("success", "fail")}?orderId=${params.orderId}`,
    webhook_url: params.webhookUrl,
    email: params.customerEmail,
    sign,
    test: config.testMode ? 1 : 0,
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
      const success = data.success === true || Boolean(paymentUrl);

      if (!response.ok || !success || !paymentUrl) {
        lastApiError = formatPallyError(data, response.status);
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

export function verifyPallyWebhook(
  body: Record<string, unknown>,
  receivedSign: string,
): boolean {
  const { shopId, secretKey } = getPallyConfig();
  const signString = `${shopId}:${body.order_id}:${body.amount}:${secretKey}`;
  const expectedSign = crypto.createHash("md5").update(signString).digest("hex");

  if (!receivedSign || receivedSign.length !== expectedSign.length) return false;
  return crypto.timingSafeEqual(Buffer.from(receivedSign), Buffer.from(expectedSign));
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
