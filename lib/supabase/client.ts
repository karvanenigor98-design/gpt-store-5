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

function browserClientOptions() {
  return {
    cookieOptions: getAuthCookieOptions(),
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  } as const;
}

/** Без throw — для client hooks/layout, где падение ломает весь кабинет. */
export function tryCreateClient(): SupabaseClient<Database> | null {
  const creds = gptBrowserCredentials();
  if (!creds) return null;
  try {
    return createBrowserClient(creds.url, creds.anon, browserClientOptions()) as SupabaseClient<Database>;
  } catch {
    return null;
  }
}

/** SSR/prerender stub — не бросает при отсутствии env на этапе build. */
function ssgPlaceholderClient(): SupabaseClient<Database> {
  return createBrowserClient(
    "https://placeholder.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIn0.placeholder",
    {
      cookieOptions: getAuthCookieOptions(),
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  ) as SupabaseClient<Database>;
}

export function createClient(): SupabaseClient<Database> {
  const client = tryCreateClient();
  if (client) return client;

  // Client components prerender on the server; missing env must not fail the build.
  if (typeof window === "undefined") {
    return ssgPlaceholderClient();
  }

  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY должны быть заданы для браузерного клиента Supabase.",
  );
}
