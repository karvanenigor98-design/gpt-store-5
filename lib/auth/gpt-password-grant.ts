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

function skipRelay(base: string): boolean {
  try {
    const u = new URL(base);
    const isIp = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(u.hostname);
    if (u.protocol === "http:" && isIp && u.port === "8787") return true;
    if (/\.trycloudflare\.com$/i.test(u.hostname)) return true;
    return false;
  } catch {
    return true;
  }
}

function relayTarget(): { base: string; secret: string } | null {
  const base = (process.env.GPT_AUTH_RELAY_URL?.trim() || "").replace(/\/$/, "");
  if (!base || skipRelay(base)) return null;
  return {
    base,
    secret: (process.env.GPT_AUTH_RELAY_SECRET || "").trim(),
  };
}

/** Vercel rewrite /__sb-auth → GoTrue. Direct supabase.co from Vercel functions hangs. */
function siteAuthGrantUrl(): string {
  const origin = (
    process.env.NEXT_PUBLIC_GPT_SITE_URL?.trim() ||
    process.env.GPT_SITE_URL?.trim() ||
    "https://gptplus-store.ru"
  ).replace(/\/$/, "");
  return `${origin}/__sb-auth/auth/v1/token?grant_type=password`;
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

async function postGrant(
  url: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs: number,
): Promise<PasswordGrantResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: ctrl.signal,
    });
    const text = await res.text();
    return parseGrantBody(res.status, text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "auth_network";
    return {
      ok: false,
      status: 503,
      message: /timeout|abort/i.test(msg) ? "timeout" : "auth_network",
    };
  } finally {
    clearTimeout(timer);
  }
}

function grantHeaders(apiKey: string): Record<string, string> {
  return {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function grantViaSiteProxy(
  email: string,
  password: string,
  apiKey: string,
  timeoutMs: number,
): Promise<PasswordGrantResult> {
  return postGrant(
    siteAuthGrantUrl(),
    grantHeaders(apiKey),
    JSON.stringify({ email, password }),
    timeoutMs,
  );
}

async function grantViaRelay(
  email: string,
  password: string,
  apiKey: string,
  timeoutMs: number,
): Promise<PasswordGrantResult> {
  const relay = relayTarget();
  const supabaseUrl = getGptPublicSupabaseUrl();
  if (!relay || !supabaseUrl) {
    return { ok: false, status: 503, message: "auth_network" };
  }
  return postGrant(
    `${relay.base}/auth/v1/token?grant_type=password`,
    {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(relay.secret ? { "X-Pally-Relay-Secret": relay.secret } : {}),
      "X-Pally-Target-Base": supabaseUrl,
    },
    JSON.stringify({ email, password }),
    timeoutMs,
  );
}

export async function gptPasswordGrant(
  email: string,
  password: string,
  timeoutMs = 8_000,
): Promise<PasswordGrantResult> {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!anon) {
    return { ok: false, status: 503, message: "Auth не настроен на сервере" };
  }

  if (relayTarget()) {
    const viaRelay = await grantViaRelay(email, password, anon, Math.min(4_000, timeoutMs));
    if (viaRelay.ok || viaRelay.status === 401 || viaRelay.status === 429) return viaRelay;
  }

  const viaSite = await grantViaSiteProxy(email, password, anon, timeoutMs);
  if (viaSite.ok || viaSite.status === 401 || viaSite.status === 429) return viaSite;

  return viaSite;
}
