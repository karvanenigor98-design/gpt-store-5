import type { SupabaseClient } from "@supabase/supabase-js";

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

/** Поднимает recovery-сессию из #hash или ?code= на текущей странице. */
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
    return { ok: false, error: error.message };
  }

  if (tokens.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(tokens.code);
    if (!error) {
      stripRecoverySecretsFromUrl();
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }

  return { ok: false, error: "no_tokens" };
}

export function stripRecoverySecretsFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.hash = "";
  url.searchParams.delete("code");
  url.searchParams.delete("token_hash");
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}
