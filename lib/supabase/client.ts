import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { getAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";
import { getGptPublicSupabaseUrl } from "@/lib/supabase/validate-project-url";

function gptBrowserCredentials(): { url: string; anon: string } | null {
  const url = getGptPublicSupabaseUrl();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !anon) return null;
  return { url, anon };
}

/** Без throw — для client hooks/layout, где падение ломает весь кабинет. */
export function tryCreateClient(): SupabaseClient<Database> | null {
  const creds = gptBrowserCredentials();
  if (!creds) return null;
  try {
    return createBrowserClient(creds.url, creds.anon, {
      cookieOptions: getAuthCookieOptions(),
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }) as SupabaseClient<Database>;
  } catch {
    return null;
  }
}

export function createClient(): SupabaseClient<Database> {
  const client = tryCreateClient();
  if (!client) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY должны быть заданы для браузерного клиента Supabase.",
    );
  }
  return client;
}
