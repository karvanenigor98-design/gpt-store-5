import type { SupabaseClient } from "@supabase/supabase-js";

import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";
import { normalizeAuthReturnUrl } from "@/lib/auth/authReturnUrl";
import { resolvePostLoginPath } from "@/lib/auth/postLoginPath";
import type { Database } from "@/types/database";
import type { UserRole } from "@/types/database";

/** Синхронизация роли, membership и редирект в кабинет после успешной client-сессии. */
export async function completeClientAuthSession(params: {
  supabase: SupabaseClient<Database>;
  site: AuthSiteSlug;
  returnUrl?: string | null;
}): Promise<string> {
  const { supabase, site } = params;
  const returnUrl = normalizeAuthReturnUrl(params.returnUrl, site);

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? "";

  const syncRes = await fetch("/api/auth/sync-role", {
    method: "POST",
    headers: {
      Authorization: accessToken ? `Bearer ${accessToken}` : "",
      "x-auth-site": site,
    },
  });
  const syncBody = (await syncRes.json().catch(() => ({}))) as { role?: UserRole };
  const role: UserRole =
    syncBody.role === "admin" || syncBody.role === "operator" || syncBody.role === "client"
      ? syncBody.role
      : "client";

  await fetch("/api/auth/ensure-site-membership", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ site }),
  }).catch(() => undefined);

  if (site === "subs-store" && typeof document !== "undefined") {
    document.cookie = "current_site=subs-store; path=/; max-age=2592000; samesite=lax";
  }

  return resolvePostLoginPath(returnUrl, role);
}
