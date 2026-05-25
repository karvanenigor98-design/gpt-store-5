import crypto from "crypto";

const PALLY_REQUEST_TIMEOUT_MS = 20_000;

const PALLY_CONFIG = {
  shopId: process.env.PALLY_SHOP_ID ?? "",
  secretKey: process.env.PALLY_SECRET_KEY ?? "",
  apiUrl: (process.env.PALLY_API_URL ?? "https://pally.info/api/v1").replace(/\/$/, ""),
  testMode: process.env.PALLY_TEST_MODE === "true",
};

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

function buildSign(orderId: string, amount: number): string {
  const signString = `${PALLY_CONFIG.shopId}:${orderId}:${amount}:${PALLY_CONFIG.secretKey}`;
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
    return "Pally отклонил запрос: IP сервера не в белом списке. Добавьте IP Vercel в настройках магазина Pally.";
  }
  if (message) return `Pally: ${message}`;
  return `Pally API ошибка (HTTP ${status})`;
}

export async function createPallyPayment(
  params: CreatePallyPaymentParams,
): Promise<PallyPaymentResult> {
  if (!PALLY_CONFIG.shopId || !PALLY_CONFIG.secretKey) {
    throw new Error("Pally не настроен: добавьте PALLY_SHOP_ID и PALLY_SECRET_KEY в переменные окружения");
  }

  const sign = buildSign(params.orderId, params.amount);

  const body = {
    shop_id: PALLY_CONFIG.shopId,
    order_id: params.orderId,
    amount: params.amount,
    currency: "RUB",
    desc: params.description,
    success_url: `${params.returnUrl}?orderId=${params.orderId}`,
    fail_url: `${params.returnUrl.replace("success", "fail")}?orderId=${params.orderId}`,
    webhook_url: params.webhookUrl,
    email: params.customerEmail,
    sign,
    test: PALLY_CONFIG.testMode ? 1 : 0,
  };

  const endpoint = `${PALLY_CONFIG.apiUrl}/bill/create`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PALLY_CONFIG.secretKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PALLY_REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const cause = err instanceof Error && "cause" in err ? String((err.cause as Error)?.code ?? "") : "";
    if (cause === "ENOTFOUND" || /fetch failed/i.test(String(err))) {
      throw new Error(
        `Не удалось связаться с Pally (${endpoint}). Проверьте PALLY_API_URL=https://pally.info/api/v1 на сервере.`,
      );
    }
    throw err instanceof Error ? err : new Error("Ошибка сети при обращении к Pally");
  }

  const text = await response.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Pally API: неожиданный ответ (${response.status})`);
  }

  const paymentUrl = resolvePaymentUrl(data);
  const success = data.success === true || Boolean(paymentUrl);

  if (!response.ok || !success || !paymentUrl) {
    throw new Error(formatPallyError(data, response.status));
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
}

export function verifyPallyWebhook(
  body: Record<string, unknown>,
  receivedSign: string,
): boolean {
  const signString = `${PALLY_CONFIG.shopId}:${body.order_id}:${body.amount}:${PALLY_CONFIG.secretKey}`;
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
