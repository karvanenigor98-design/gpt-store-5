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

export async function gptPasswordGrant(
  email: string,
  password: string,
  timeoutMs = 8_000,
): Promise<PasswordGrantResult> {
  const url = getGptPublicSupabaseUrl();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !anon) {
    return { ok: false, status: 503, message: "Auth не настроен на сервере" };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      signal: ctrl.signal,
    });
    const json = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
      expires_in?: number;
      user?: User;
      error?: string;
      error_description?: string;
      msg?: string;
      message?: string;
    };
    if (!res.ok || !json.access_token || !json.refresh_token || !json.user) {
      const message =
        json.error_description || json.msg || json.message || json.error || `auth_${res.status}`;
      return { ok: false, status: res.status || 401, message: String(message) };
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
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: 503,
      message: aborted ? "timeout" : "auth_network",
    };
  } finally {
    clearTimeout(timer);
  }
}
