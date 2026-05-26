import { ProxyAgent, fetch as undiciFetch } from "undici";

const DEFAULT_TIMEOUT_MS = 20_000;

function relayConfig(): { base: string; secret: string } | null {
  const base = process.env.PALLY_RELAY_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  return { base, secret: process.env.PALLY_RELAY_SECRET?.trim() ?? "" };
}

function proxyDispatcher(): ProxyAgent | undefined {
  const proxy =
    process.env.PALLY_HTTP_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim();
  if (!proxy) return undefined;
  return new ProxyAgent(proxy);
}

/** POST к Pally напрямую, через HTTP-прокси или через relay с фиксированным egress IP. */
export async function pallyHttpPost(
  apiBaseUrl: string,
  path: string,
  init: { headers: Record<string, string>; body: string },
): Promise<Response> {
  const relay = relayConfig();
  const normalizedBase = apiBaseUrl.replace(/\/$/, "");
  const directUrl = `${normalizedBase}${path.startsWith("/") ? path : `/${path}`}`;

  let url = directUrl;
  const headers = { ...init.headers };

  if (relay) {
    url = `${relay.base}${path.startsWith("/") ? path : `/${path}`}`;
    if (relay.secret) headers["X-Pally-Relay-Secret"] = relay.secret;
    headers["X-Pally-Target-Base"] = normalizedBase;
  }

  const dispatcher = proxyDispatcher();

  return undiciFetch(url, {
    method: "POST",
    headers,
    body: init.body,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    dispatcher,
  }) as unknown as Promise<Response>;
}

/** Текущий исходящий IP (для диагностики ip_access_denied). */
export async function detectEgressIp(): Promise<string | null> {
  try {
    const dispatcher = proxyDispatcher();
    const res = (await undiciFetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(8_000),
      dispatcher,
    })) as unknown as Response;
    if (!res.ok) return null;
    const data = (await res.json()) as { ip?: string };
    return data.ip ?? null;
  } catch {
    return null;
  }
}
