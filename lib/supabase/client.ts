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

function gptBrowserFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof window === "undefined") return fetch(input, init);
  try {
    const raw =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const target = new URL(raw, window.location.origin);
    const sb = getGptPublicSupabaseUrl();
    if (sb) {
      const sbHost = new URL(sb).hostname;
      const sameHost = target.hostname === sbHost;
      const proxiedPath =
        target.pathname.startsWith("/auth/") || target.pathname.startsWith("/rest/");
      if (sameHost && proxiedPath) {
        const proxied = `${window.location.origin}/__sb-auth${target.pathname}${target.search}`;
        if (typeof input === "string" || input instanceof URL) return fetch(proxied, init);
        return fetch(new Request(proxied, input), init);
      }
    }
  } catch {
    /* same-origin fallback ниже */
  }
  return fetch(input, init);
}

function browserClientOptions() {
  return {
    cookieOptions: getAuthCookieOptions(),
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: gptBrowserFetch,
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
