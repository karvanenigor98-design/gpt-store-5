import dns from "node:dns";
import https from "node:https";
import { lookup as dnsLookup } from "node:dns";
import type { User } from "@supabase/supabase-js";

import type { PasswordGrantResult } from "@/lib/auth/gpt-password-grant";
import { getGptPublicSupabaseUrl } from "@/lib/supabase/validate-project-url";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

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

function postGrant(
  opts: {
    hostname: string;
    servername: string;
    apiKey: string;
    body: string;
    timeoutMs: number;
    useIp: boolean;
  },
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: opts.hostname,
        servername: opts.servername,
        setHost: false,
        port: 443,
        path: "/auth/v1/token?grant_type=password",
        method: "POST",
        family: 4,
        timeout: opts.timeoutMs,
        lookup: opts.useIp
          ? (host, _o, cb) => cb(null, host, 4)
          : (host, _o, cb) => {
              dnsLookup(host, { family: 4, all: false }, cb);
            },
        headers: {
          Host: opts.servername,
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

function isUseful(result: PasswordGrantResult): boolean {
  return result.ok || result.status === 401 || result.status === 400 || result.status === 429;
}

/**
 * Password grant from Vercel Node via IPv4 + SNI.
 * RU recursive DNS poisons supabase.co; Vercel fetch/undici to supabase.co often hangs.
 */
export async function gptPasswordGrantIpv4(
  email: string,
  password: string,
  timeoutMs = 18_000,
): Promise<PasswordGrantResult> {
  const base = getGptPublicSupabaseUrl();
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!base || !apiKey) {
    return { ok: false, status: 503, message: "auth_network" };
  }
  const servername = new URL(base).hostname;
  const body = JSON.stringify({ email, password });

  const targets: { hostname: string; useIp: boolean }[] = [
    { hostname: servername, useIp: false },
    ...FALLBACK_IPV4.map((hostname) => ({ hostname, useIp: true })),
  ];

  return await new Promise<PasswordGrantResult>((resolve) => {
    let pending = targets.length;
    let settled = false;
    let last: PasswordGrantResult = { ok: false, status: 503, message: "auth_network" };
    const finish = (result: PasswordGrantResult) => {
      if (settled) return;
      last = result;
      if (isUseful(result)) {
        settled = true;
        resolve(result);
        return;
      }
      pending -= 1;
      if (pending <= 0) {
        settled = true;
        resolve(last);
      }
    };
    for (const target of targets) {
      void postGrant({
        hostname: target.hostname,
        servername,
        apiKey,
        body,
        timeoutMs,
        useIp: target.useIp,
      })
        .then(({ status, body: text }) => finish(parseGrant(status, text, email)))
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "auth_network";
          finish({
            ok: false,
            status: 503,
            message: /timeout/i.test(msg) ? "timeout" : "auth_network",
          });
        });
    }
  });
}
