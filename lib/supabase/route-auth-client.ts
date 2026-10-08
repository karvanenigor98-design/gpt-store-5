import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { getAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";
import { getGptPublicSupabaseUrl } from "@/lib/supabase/validate-project-url";

type CookieRow = { name: string; value: string; options?: CookieOptions };

/** Route Handler login/logout: cookie пишем и в cookieStore, и в JSON-ответ. */
export async function createGptRouteAuthClient(): Promise<{
  supabase: SupabaseClient<Database>;
  applyCookies: (res: NextResponse) => void;
}> {
  const url = getGptPublicSupabaseUrl();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !anon) {
    throw new Error("GPT Auth env missing");
  }

  const cookieStore = await cookies();
  const pending: CookieRow[] = [];

  const supabase = createServerClient<Database>(url, anon, {
    cookieOptions: getAuthCookieOptions(),
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          pending.push({ name, value, options });
          try {
            cookieStore.set(name, value, options);
          } catch {
            /* RSC / already committed */
          }
        });
      },
    },
  });

  return {
    supabase: supabase as SupabaseClient<Database>,
    applyCookies(res: NextResponse) {
      for (const row of pending) {
        res.cookies.set(row.name, row.value, row.options);
      }
    },
  };
}
