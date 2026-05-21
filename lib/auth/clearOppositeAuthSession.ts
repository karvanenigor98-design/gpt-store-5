import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";

import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { getAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";
import {
  getSubsPublicSupabaseAnonKey,
  getSubsPublicSupabaseUrl,
  isSubsPublicAuthConfigured,
} from "@/lib/supabase/subs-auth-env";
import type { Database } from "@/types/database";

type CookieRow = { name: string; value: string; options?: CookieOptions };
type CookieStoreLike = {
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options?: CookieOptions): void;
};

/** Сбрасывает сессию другого Supabase-проекта (GPT ↔ Subs), чтобы не остаться под чужим аккаунтом. */
export async function clearOppositeAuthSession(
  activeSite: SiteSlug,
  cookieStore: CookieStoreLike,
  onSet?: (row: CookieRow) => void,
): Promise<void> {
  const clearGpt = activeSite === "subs-store";
  const clearSubs = activeSite === "gpt-store";

  const url = clearGpt
    ? (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()
    : getSubsPublicSupabaseUrl();
  const anon = clearGpt
    ? (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim()
    : getSubsPublicSupabaseAnonKey();

  if (clearSubs && !isSubsPublicAuthConfigured()) return;
  if (!url || !anon) return;

  const sb = createServerClient<Database>(url, anon, {
    cookieOptions: getAuthCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const row of cookiesToSet) {
          onSet?.(row);
          try {
            cookieStore.set(row.name, row.value, row.options);
          } catch {
            /* ignore */
          }
        }
      },
    },
  });

  await sb.auth.signOut({ scope: "local" }).catch(() => undefined);
}
