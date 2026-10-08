import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { getAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";
import { getGptPublicSupabaseUrl } from "@/lib/supabase/validate-project-url";

type CookieRow = { name: string; value: string; options?: CookieOptions };

function gptAuthCreds(): { url: string; anon: string } {
  const url = getGptPublicSupabaseUrl();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !anon) {
    throw new Error("GPT Auth env missing");
  }
  return { url, anon };
}

/** Route Handler login: не читаем старые cookie (refresh зависал на 20с). Пишем только в ответ. */
export async function createGptRouteAuthClient(): Promise<{
  supabase: SupabaseClient<Database>;
  applyCookies: (res: NextResponse) => void;
}> {
  const { url, anon } = gptAuthCreds();
  const pending: CookieRow[] = [];

  const supabase = createServerClient<Database>(url, anon, {
    cookieOptions: getAuthCookieOptions(),
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    cookies: {
      getAll() {
        return [];
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          pending.push({ name, value, options });
        });
      },
    },
  });

  return {
    supabase: supabase as SupabaseClient<Database>,
    applyCookies(res: NextResponse) {
      const opts = getAuthCookieOptions();
      for (const row of pending) {
        res.cookies.set(row.name, row.value, { ...opts, ...row.options, httpOnly: true });
      }
    },
  };
}
