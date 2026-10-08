import https from "node:https";
import type { User } from "@supabase/supabase-js";

import { getGptPublicSupabaseUrl } from "@/lib/supabase/validate-project-url";

export type PasswordGrantResult =
  | {
      ok: true;
      accessToken: string;
      refreshToken: string;
      user: User;
      expiresAt?: number;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

function postJson(
  url: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs: number,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: `${u.pathname}${u.search}`,
        method: "POST",
        headers: {
          ...headers,
          "Content-Length": String(Buffer.byteLength(body)),
        },
        timeout: timeoutMs,
        family: 4,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function parseGrantBody(status: number, body: string): PasswordGrantResult {
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
  if (status < 200 || status >= 300 || !json.access_token || !json.refresh_token || !json.user) {
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
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    user: json.user,
    expiresAt,
  };
}

async function grantOnce(
  email: string,
  password: string,
  apiKey: string,
  timeoutMs: number,
): Promise<PasswordGrantResult> {
  const url = getGptPublicSupabaseUrl();
  if (!url || !apiKey) {
    return { ok: false, status: 503, message: "Auth не настроен на сервере" };
  }
  try {
    const { status, body } = await postJson(
      `${url}/auth/v1/token?grant_type=password`,
      {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      JSON.stringify({ email, password }),
      timeoutMs,
    );
    return parseGrantBody(status, body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "auth_network";
    return {
      ok: false,
      status: 503,
      message: msg.includes("timeout") ? "timeout" : "auth_network",
    };
  }
}

export async function gptPasswordGrant(
  email: string,
  password: string,
  timeoutMs = 12_000,
): Promise<PasswordGrantResult> {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!anon) {
    return { ok: false, status: 503, message: "Auth не настроен на сервере" };
  }
  return grantOnce(email, password, anon, timeoutMs);
}
