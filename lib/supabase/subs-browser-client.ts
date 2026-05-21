"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { getAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";
import {
  getSubsPublicSupabaseAnonKey,
  getSubsPublicSupabaseUrl,
} from "@/lib/supabase/subs-auth-env";

/** Браузерный клиент Subs Store (отдельный Supabase-проект / Auth). */
export function createSubsBrowserClient(): SupabaseClient<Database> {
  const url = getSubsPublicSupabaseUrl();
  const anon = getSubsPublicSupabaseAnonKey();
  if (!url || !anon) {
    throw new Error(
      "Subs Store Auth не сконфигурирован: задайте NEXT_PUBLIC_SUBS_SUPABASE_URL и NEXT_PUBLIC_SUBS_SUPABASE_ANON_KEY в .env.local",
    );
  }
  return createBrowserClient(url, anon, {
    cookieOptions: getAuthCookieOptions(),
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }) as SupabaseClient<Database>;
}

export function tryCreateSubsBrowserClient(): SupabaseClient<Database> | null {
  try {
    return createSubsBrowserClient();
  } catch {
    return null;
  }
}
