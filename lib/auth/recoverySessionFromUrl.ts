import type { SupabaseClient } from "@supabase/supabase-js";

import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";
import { defaultCustomerDashboard } from "@/lib/auth/authReturnUrl";
import { createClient } from "@/lib/supabase/client";
import { createSubsBrowserClient } from "@/lib/supabase/subs-browser-client";
import type { Database } from "@/types/database";

function parseHashParams(hash: string): Record<string, string> {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(h);
  const out: Record<string, string> = {};
  params.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

export type RecoveryUrlTokens = {
  code: string | null;
  token_hash: string | null;
  type: string | null;
  access_token: string | null;
  refresh_token: string | null;
};

export function readRecoveryTokensFromWindow(): RecoveryUrlTokens {
  if (typeof window === "undefined") {
    return {
      code: null,
      token_hash: null,
      type: null,
      access_token: null,
      refresh_token: null,
    };
  }
  const url = new URL(window.location.href);
  const hashParams = parseHashParams(window.location.hash);
  return {
    code: url.searchParams.get("code"),
    token_hash: url.searchParams.get("token_hash"),
    type: url.searchParams.get("type") ?? hashParams.type ?? null,
    access_token: hashParams.access_token ?? null,
    refresh_token: hashParams.refresh_token ?? null,
  };
}

export function hasRecoveryTokensInUrl(): boolean {
  const t = readRecoveryTokensFromWindow();
  return Boolean(t.code || t.token_hash || (t.access_token && t.refresh_token));
}

/** Перенаправляет на /callback или /auth/callback, чтобы поднять сессию из письма. */
export function redirectToRecoveryHandler(site: AuthSiteSlug, returnUrl?: string | null): void {
  if (typeof window === "undefined") return;
  const tokens = readRecoveryTokensFromWindow();
  const postReset = returnUrl?.trim() || defaultCustomerDashboard(site);

  document.cookie = `auth_reset_site=${site}; path=/; max-age=3600; samesite=lax`;
  document.cookie = `current_site=${site}; path=/; max-age=2592000; samesite=lax`;

  if (tokens.token_hash) {
    const q = new URLSearchParams();
    q.set("token_hash", tokens.token_hash);
    q.set("type", "recovery");
    q.set("site", site);
    q.set("returnUrl", postReset);
    window.location.replace(`/auth/callback?${q.toString()}`);
    return;
  }

  const cb = new URL("/callback", window.location.origin);
  cb.searchParams.set("type", "recovery");
  cb.searchParams.set("site", site);
  cb.searchParams.set("returnUrl", postReset);
  if (tokens.code) cb.searchParams.set("code", tokens.code);
  const hash = window.location.hash || "";
  window.location.replace(`${cb.pathname}${cb.search}${hash}`);
}

function clientForSite(site: AuthSiteSlug): SupabaseClient<Database> {
  return site === "subs-store" ? createSubsBrowserClient() : createClient();
}

/** Поднимает recovery-сессию из #hash или ?code= (пробует оба Supabase-проекта). */
export async function establishRecoverySessionFromUrl(
  supabase: SupabaseClient<Database>,
): Promise<{ ok: boolean; error?: string }> {
  const tokens = readRecoveryTokensFromWindow();

  const {
    data: { session: existing },
  } = await supabase.auth.getSession();
  if (existing) return { ok: true };

  if (tokens.access_token && tokens.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
    if (!error) {
      stripRecoverySecretsFromUrl();
      return { ok: true };
    }
  }

  if (tokens.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(tokens.code);
    if (!error) {
      stripRecoverySecretsFromUrl();
      return { ok: true };
    }
  }

  return { ok: false, error: "no_tokens" };
}

export async function establishRecoverySessionForSite(
  site: AuthSiteSlug,
): Promise<{ ok: boolean; supabase: SupabaseClient<Database> }> {
  const primary = clientForSite(site);
  const primaryResult = await establishRecoverySessionFromUrl(primary);
  if (primaryResult.ok) return { ok: true, supabase: primary };

  const secondary = site === "subs-store" ? createClient() : createSubsBrowserClient();
  const secondaryResult = await establishRecoverySessionFromUrl(secondary);
  if (secondaryResult.ok) return { ok: true, supabase: secondary };

  return { ok: false, supabase: primary };
}

export function stripRecoverySecretsFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.hash = "";
  url.searchParams.delete("code");
  url.searchParams.delete("token_hash");
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}
