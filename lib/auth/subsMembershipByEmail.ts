import { isSuperAdminEmail } from "@/lib/auth/superAdmin";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

/**
 * Subs Store: пользователь зарегистрирован в Supabase проекта spotify (profiles или auth.users).
 * Не использовать GPT-проект — иначе «аккаунт не найден» при существующем email в Subs Auth.
 */
export async function hasSubsStoreAuthUserByEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (isSuperAdminEmail(normalized)) return true;

  const subs = createSubsStoreAdminClient();
  if (!subs) return false;

  try {
    const { data: profileRow, error: profileError } = await subs
      .from("profiles")
      .select("id")
      .ilike("email", normalized)
      .maybeSingle();

    const profile = profileRow as { id?: string } | null;

    if (profileError) {
      if (
        profileError.message?.includes("does not exist") ||
        profileError.message?.includes("relation")
      ) {
        /* profiles может отсутствовать — ищем в auth */
      }
    }

    if (profile?.id) return true;

    let page = 1;
    while (page <= 50) {
      const { data, error } = await subs.auth.admin.listUsers({ page, perPage: 200 });
      if (error) {
        console.error("[subs-auth-by-email] listUsers:", error.message);
        return false;
      }
      const list = data.users ?? [];
      if (!list.length) break;
      if (list.some((u) => (u.email ?? "").toLowerCase() === normalized)) {
        return true;
      }
      if (list.length < 200) break;
      page += 1;
    }

    return false;
  } catch (e) {
    console.error("[subs-auth-by-email] unexpected:", e);
    return false;
  }
}

/** @deprecated Используйте hasSubsStoreAuthUserByEmail */
export const hasSubsStoreCustomerMembershipByEmail = hasSubsStoreAuthUserByEmail;
