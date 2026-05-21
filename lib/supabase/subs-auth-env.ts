import { normalizeSubsSupabaseUrl } from "@/lib/supabase/subs-store-admin";

/** Публичные URL/key для браузера + Edge middleware (anon — не секрет для Supabase). */
export function getSubsPublicSupabaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SUBS_SUPABASE_URL?.trim() ||
    process.env.SUBS_NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUBS_SUPABASE_URL?.trim() ||
    "";
  if (!raw) return "";
  return normalizeSubsSupabaseUrl(raw.replace(/^["']|["']$/g, "").trim());
}

export function getSubsPublicSupabaseAnonKey(): string {
  const raw =
    process.env.NEXT_PUBLIC_SUBS_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUBS_SUPABASE_ANON_KEY?.trim() ||
    "";
  return raw.replace(/^["']|["']$/g, "").trim();
}

export function isSubsPublicAuthConfigured(): boolean {
  return Boolean(getSubsPublicSupabaseUrl() && getSubsPublicSupabaseAnonKey());
}
