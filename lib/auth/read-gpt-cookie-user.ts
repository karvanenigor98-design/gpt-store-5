import type { SupabaseClient, User } from "@supabase/supabase-js";

/** JWT из cookie, без getUser/refresh — параллельный getUser убивает refresh_token и выкидывает с сессии. */
export async function readGptCookieUser(
  supabase: SupabaseClient,
): Promise<{ user: User | null; expiresAt: number | undefined }> {
  const { data } = await supabase.auth.getSession();
  return {
    user: data.session?.user ?? null,
    expiresAt: data.session?.expires_at,
  };
}
