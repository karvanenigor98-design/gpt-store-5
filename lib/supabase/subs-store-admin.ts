/**
 * Service-role Supabase client for the Subs Store project only.
 * Used from GPT STORE admin server code when site=subs-store.
 * Never import this module from client components.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SubsStoreAdminClient = SupabaseClient;

/** Trim, strip wrapping quotes, keep valid https project URL. */
export function normalizeSubsSupabaseUrl(raw: string): string {
  let s = raw.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  try {
    const u = new URL(s);
    if (u.protocol !== "https:") return s;
    let host = u.hostname;
    // Частая опечатка в ref (…nzrwl / …tnznwl) — в Dashboard проекта spotify: …inhnznwl…
    if (host.includes("csolintnzrwl") || host.includes("csolintnznwl")) {
      host = host.replace(/csolintnzrwl|csolintnznwl/g, "csolinhnznwl");
    }
    return `https://${host}`;
  } catch {
    return s;
  }
}

export function isSubsStoreBackendConfigured(): boolean {
  return Boolean(
    (process.env.SUBS_SUPABASE_URL || process.env.SUBS_NEXT_PUBLIC_SUPABASE_URL)?.length &&
      process.env.SUBS_SUPABASE_SERVICE_ROLE_KEY?.length
  );
}

/**
 * Creates admin client for Subs Store DB. Returns null if env is missing (caller shows setup hint).
 */
export function createSubsStoreAdminClient(): SubsStoreAdminClient | null {
  const rawUrl =
    process.env.SUBS_SUPABASE_URL?.trim() ||
    process.env.SUBS_NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  let key = process.env.SUBS_SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  const url = rawUrl ? normalizeSubsSupabaseUrl(rawUrl) : "";
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
