import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { getAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";
import {
  getSubsPublicSupabaseAnonKey,
  getSubsPublicSupabaseUrl,
} from "@/lib/supabase/subs-auth-env";

/** Server Components / Route Handlers: сессия Subs через cookies SSR. */
export async function createSubsAuthServerClient(): Promise<SupabaseClient<Database> | null> {
  const url = getSubsPublicSupabaseUrl();
  const anon = getSubsPublicSupabaseAnonKey();
  if (!url || !anon) return null;

  const cookieStore = await cookies();
  return createServerClient(url, anon, {
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
          /* Server-only read context */
        }
      },
    },
  }) as SupabaseClient<Database>;
}
