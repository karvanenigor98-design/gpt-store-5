import { createAdminClient } from "@/lib/supabase/server";

/** Пользователь уже есть в GPT Supabase (profiles или auth.users). */
export async function hasGptStoreAuthUserByEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  const admin = createAdminClient();

  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", normalized)
      .maybeSingle();

    if (profile?.id) return true;

    let page = 1;
    while (page <= 50) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) {
        console.error("[gpt-auth-by-email] listUsers:", error.message);
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
    console.error("[gpt-auth-by-email] unexpected:", e);
    return false;
  }
}
