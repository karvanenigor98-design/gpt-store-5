import https from "node:https";
import type { User } from "@supabase/supabase-js";

import type { PasswordGrantResult } from "@/lib/auth/gpt-password-grant";
import { getGptPublicSupabaseUrl } from "@/lib/supabase/validate-project-url";

/** Cloudflare Anycast for this project — used if DoH fails. RU recursive DNS poisons supabase.co. */
const FALLBACK_IPV4 = ["104.18.38.10", "172.64.149.246"];

function userFromAccessToken(access: string, email: string): User | null {
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

async function resolveGoTrueIpv4(_servername: string): Promise<string[]> {
  return FALLBACK_IPV4;
}

function postGrantToIp(
  ip: string,
  servername: string,
  apiKey: string,
  body: string,
  timeoutMs: number,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: ip,
        servername,
        setHost: false,
        port: 443,
        path: "/auth/v1/token?grant_type=password",
        method: "POST",
        family: 4,
        timeout: timeoutMs,
        headers: {
          Host: servername,
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": String(Buffer.byteLength(body)),
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
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * Password grant from Vercel Node: DoH → Cloudflare IPv4 + SNI.
 * Never uses undici fetch to supabase.co (hangs) and never trusts RU DNS.
 */
export async function gptPasswordGrantIpv4(
  email: string,
  password: string,
  timeoutMs = 8_000,
): Promise<PasswordGrantResult> {
  const base = getGptPublicSupabaseUrl();
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!base || !apiKey) {
    return { ok: false, status: 503, message: "Auth не настроен на сервере" };
  }
  const servername = new URL(base).hostname;
  const body = JSON.stringify({ email, password });
  const ips = await resolveGoTrueIpv4(servername);
  return await new Promise<PasswordGrantResult>((resolve) => {
    let pending = Math.min(2, ips.length);
    let last: PasswordGrantResult = { ok: false, status: 503, message: "auth_network" };
    const done = (result: PasswordGrantResult) => {
      last = result;
      if (result.ok || result.status === 401 || result.status === 400 || result.status === 429) {
        resolve(result);
        pending = 0;
        return;
      }
      pending -= 1;
      if (pending <= 0) resolve(last);
    };
    for (const ip of ips.slice(0, 2)) {
      void postGrantToIp(ip, servername, apiKey, body, timeoutMs)
        .then(({ status, body: text }) => done(parseGrant(status, text, email)))
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "auth_network";
          done({
            ok: false,
            status: 503,
            message: msg.includes("timeout") ? "timeout" : "auth_network",
          });
        });
    }
  });
}
