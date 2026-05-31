import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { tryCreateClient } from "@/lib/supabase/server";
import { createSubsAuthServerClient } from "@/lib/supabase/subs-auth-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type SiteSupabaseBundle = {
  /** Какому проекту принадлежит сессия */
  backend: "gpt" | "subs";
  /** Клиент с cookie-сессией пользователя (RLS как у браузера) */
  browserLike: SupabaseClient<Database>;
};

/**
 * Кабинет / публичные страницы: выбираем Supabase по текущему магазину.
 * Операторская /admin всегда остаётся на GPT-проекте через createClient().
 */
export async function createSiteSessionClient(siteSlug: SiteSlug): Promise<SiteSupabaseBundle> {
  if (siteSlug === "subs-store") {
    const subs = await createSubsAuthServerClient();
    if (!subs) {
      throw new Error(
        "subs_auth_env_missing:NEXT_PUBLIC_SUBS_SUPABASE_URL и NEXT_PUBLIC_SUBS_SUPABASE_ANON_KEY должны быть в .env.local",
      );
    }
    return { backend: "subs", browserLike: subs };
  }

  const gpt = await tryCreateClient();
  if (!gpt) {
    throw new Error(
      "gpt_auth_env_missing:NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY должны быть в .env.local",
    );
  }
  return { backend: "gpt", browserLike: gpt };
}
