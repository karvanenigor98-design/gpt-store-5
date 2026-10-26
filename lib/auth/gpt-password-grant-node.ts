import https from "node:https";
import type { User } from "@supabase/supabase-js";

import type { PasswordGrantResult } from "@/lib/auth/gpt-password-grant";
import { getGptPublicSupabaseUrl } from "@/lib/supabase/validate-project-url";

export function userFromAccessToken(access: string, email: string): User | null {
  const parts = access.split(".");
  if (parts.length < 2) return null;
  try {
    const json = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = json + "=".repeat((4 - (json.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(pad, "base64").toString("utf8")) as {
      sub?: string;
      email?: string;
    };
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: payload.email || email,
      aud: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: "",
    } as User;
  } catch {
    return null;
  }
}

function parseGrant(status: number, body: string, email: string): PasswordGrantResult {
  let json: {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    expires_in?: number;
    user?: User;
    error?: string;
    error_description?: string;
    msg?: string;
    message?: string;
  } = {};
  try {
    json = JSON.parse(body || "{}") as typeof json;
  } catch {
    return { ok: false, status: status || 503, message: "auth_parse" };
  }
  const access = json.access_token ?? "";
  const refresh = json.refresh_token ?? "";
  const user = json.user?.id ? json.user : userFromAccessToken(access, email);
  if (status < 200 || status >= 300 || !access || !refresh || !user?.id) {
    const message =
      json.error_description || json.msg || json.message || json.error || `auth_${status}`;
    return { ok: false, status: status || 401, message: String(message) };
  }
  const expiresAt =
    typeof json.expires_at === "number"
      ? json.expires_at
      : typeof json.expires_in === "number"
        ? Math.floor(Date.now() / 1000) + json.expires_in
        : undefined;
  return {
    ok: true,
    accessToken: access,
    refreshToken: refresh,
    user,
    expiresAt,
  };
}

function postGrant(opts: {
  hostname: string;
  servername: string;
  hostHeader: string;
  path: string;
  apiKey: string;
  body: string;
  timeoutMs: number;
  pinIp?: boolean;
}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: opts.hostname,
        servername: opts.servername,
        setHost: false,
        port: 443,
        path: opts.path,
        method: "POST",
        family: 4,
        timeout: opts.timeoutMs,
        ...(opts.pinIp ? { lookup: (host, _o, cb) => cb(null, host, 4) } : {}),
        headers: {
          Host: opts.hostHeader,
          apikey: opts.apiKey,
          Authorization: `Bearer ${opts.apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": String(Buffer.byteLength(opts.body)),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") });
        });
      },
    );
    req.setTimeout(opts.timeoutMs, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.write(opts.body);
    req.end();
  });
}

const GOTRUE_DIRECT_IPS = ["8.6.112.0", "8.47.69.0"] as const;

function usableGrant(parsed: PasswordGrantResult): boolean {
  return parsed.ok || parsed.status === 400 || parsed.status === 401 || parsed.status === 429;
}

function gotrueProxyBase(): string {
  const raw = (process.env.GPT_GOTRUE_PROXY_URL || "https://gptplus-store.ru/__sb-auth").trim();
  return raw.replace(/\/$/, "");
}

/**
 * One grant at a time. Parallel Promise.any stampeded GoTrue and hung real logins
 * (invalid emails 401 instantly; a real account deadlocked / timed out).
 */
export async function gptPasswordGrantIpv4(
  email: string,
  password: string,
  timeoutMs = 12_000,
): Promise<PasswordGrantResult> {
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!apiKey) {
    return { ok: false, status: 503, message: "auth_network" };
  }
  const body = JSON.stringify({ email, password });
  const gotrueHost = gptGoTrueServername();
  const perTry = 7_000;
  const deadline = Date.now() + Math.max(timeoutMs, 15_000);
  const path = "/auth/v1/token?grant_type=password";

  const run = async (fn: () => Promise<{ status: number; body: string }>): Promise<PasswordGrantResult> => {
    try {
      const { status, body: text } = await fn();
      return parseGrant(status, text, email);
    } catch {
      return { ok: false, status: 503, message: "timeout" };
    }
  };

  const attempts: Array<() => Promise<PasswordGrantResult>> = [
    () =>
      run(async () => {
        const res = await fetch(`https://${gotrueHost}${path}`, {
          method: "POST",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body,
          signal: AbortSignal.timeout(perTry),
        });
        return { status: res.status, body: await res.text() };
      }),
    () =>
      run(async () => {
        const res = await fetch(`${gotrueProxyBase()}${path}`, {
          method: "POST",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body,
          signal: AbortSignal.timeout(perTry),
        });
        return { status: res.status, body: await res.text() };
      }),
    ...GOTRUE_DIRECT_IPS.map(
      (ip) => () =>
        run(() =>
          postGrant({
            hostname: ip,
            servername: gotrueHost,
            hostHeader: gotrueHost,
            path,
            apiKey,
            body,
            timeoutMs: perTry,
            pinIp: true,
          }),
        ),
    ),
  ];

  let last: PasswordGrantResult = { ok: false, status: 503, message: "auth_network" };
  for (const attempt of attempts) {
    if (Date.now() >= deadline) break;
    last = await attempt();
    if (usableGrant(last)) return last;
  }
  return last;
}

export function gptGoTrueServername(): string {
  try {
    return new URL(getGptPublicSupabaseUrl()).hostname;
  } catch {
    return "cgamktdrqkxnnmnruvvq.supabase.co";
  }
}
