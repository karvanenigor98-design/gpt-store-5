import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";
import { getAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";
import {
  getGptPublicSupabaseUrl,
  isValidSupabaseProjectUrl,
  supabaseUrlConfigHint,
} from "@/lib/supabase/validate-project-url";

function isLikelySupabaseJwt(key: string | null | undefined): boolean {
  const k = key?.trim() ?? "";
  return k.length >= 100 && k.length <= 400 && /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(k);
}

function gptServerCredentials(): { url: string; anon: string } | null {
  if (!isValidSupabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) return null;
  const url = getGptPublicSupabaseUrl();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !isLikelySupabaseJwt(anon)) return null;
  return { url, anon };
}

function gptAdminCredentials(): { url: string; serviceKey: string } | null {
  if (!isValidSupabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) return null;
  const url = getGptPublicSupabaseUrl();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !isLikelySupabaseJwt(serviceKey)) return null;
  return { url, serviceKey };
}

/** Без throw — для layout/guard, где падение ломает весь кабинет. */
export async function tryCreateClient(): Promise<SupabaseClient<Database> | null> {
  const creds = gptServerCredentials();
  if (!creds) return null;
  try {
    const cookieStore = await cookies();
    return createServerClient(creds.url, creds.anon, {
      cookieOptions: getAuthCookieOptions(),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Вызов из Server Component — игнорируем
          }
        },
      },
    }) as SupabaseClient<Database>;
  } catch {
    return null;
  }
}

export async function createClient(): Promise<SupabaseClient<Database>> {
  const creds = gptServerCredentials();
  if (!creds) {
    throw new Error(
      `GPT Supabase env invalid. ${supabaseUrlConfigHint("NEXT_PUBLIC_SUPABASE_URL")} ` +
        "Также нужен NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  const cookieStore = await cookies();
  return createServerClient(creds.url, creds.anon, {
    cookieOptions: getAuthCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Вызов из Server Component — игнорируем
        }
      },
    },
  }) as SupabaseClient<Database>;
}

/** Административный клиент (обходит RLS) — только на сервере. */
export function tryCreateAdminClient(): SupabaseClient<Database> | null {
  const creds = gptAdminCredentials();
  if (!creds) return null;
  try {
    return createSupabaseClient(creds.url, creds.serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }) as SupabaseClient<Database>;
  } catch {
    return null;
  }
}

export function createAdminClient(): SupabaseClient<Database> {
  const client = tryCreateAdminClient();
  if (!client) {
    throw new Error(
      `GPT Supabase admin env invalid. ${supabaseUrlConfigHint("NEXT_PUBLIC_SUPABASE_URL")} ` +
        "Также нужен SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return client;
}
