import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmail";

export type EmailConfirmationState = {
  exists: boolean;
  emailConfirmed: boolean;
  signupSite: AuthSiteSlug | null;
  userId: string | null;
};

async function findUserByEmail(
  listUsers: (args: { page: number; perPage: number }) => Promise<{
    data: { users: Array<{
      id?: string;
      email?: string;
      email_confirmed_at?: string | null;
      user_metadata?: Record<string, unknown>;
    }> } | null;
    error: { message: string } | null;
  }>,
  email: string,
) {
  const normalized = normalizeEmailForAuth(email);
  if (!normalized) return null;

  let page = 1;
  while (page <= 50) {
    const { data, error } = await listUsers({ page, perPage: 200 });
    if (error) {
      console.error("[get-auth-user-by-email] listUsers:", error.message);
      return null;
    }
    const list = data?.users ?? [];
    if (!list.length) return null;
    const hit = list.find((u) => normalizeEmailForAuth(u.email ?? "") === normalized);
    if (hit) return hit;
    if (list.length < 200) break;
    page += 1;
  }
  return null;
}

/** Проверка подтверждения email через Admin API (без сессии пользователя). */
export async function getEmailConfirmationState(
  email: string,
  site: AuthSiteSlug,
): Promise<EmailConfirmationState> {
  const normalized = normalizeEmailForAuth(email);
  if (!normalized) {
    return { exists: false, emailConfirmed: false, signupSite: null, userId: null };
  }

  const admin =
    site === "subs-store" ? createSubsStoreAdminClient() : createAdminClient();
  if (!admin) {
    return { exists: false, emailConfirmed: false, signupSite: null, userId: null };
  }

  const user = await findUserByEmail(
    (args) => admin.auth.admin.listUsers(args),
    normalized,
  );

  if (!user) {
    return { exists: false, emailConfirmed: false, signupSite: null, userId: null };
  }

  const metaSite = user.user_metadata?.signup_site;
  const signupSite: AuthSiteSlug | null =
    metaSite === "subs-store" || metaSite === "gpt-store" ? metaSite : null;

  const userId =
    typeof (user as { id?: string }).id === "string" ? (user as { id: string }).id : null;

  return {
    exists: true,
    emailConfirmed: Boolean(user.email_confirmed_at),
    signupSite,
    userId,
  };
}
