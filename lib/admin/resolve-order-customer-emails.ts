import type { SupabaseClient } from "@supabase/supabase-js";

/** Email клиента для GPT-заказов: profiles.email по user_id (не account_email ChatGPT). */
export async function resolveGptOrderCustomerEmails(
  admin: SupabaseClient,
  rows: { user_id: string | null; account_email?: string | null }[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const userIds = [...new Set(rows.map((r) => r.user_id).filter((id): id is string => Boolean(id)))];
  if (!userIds.length) return out;

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email")
    .in("id", userIds);

  for (const p of profiles ?? []) {
    const email = (p.email as string | null)?.trim().toLowerCase();
    if (email && p.id) out.set(p.id as string, email);
  }

  return out;
}

export function pickCustomerEmail(
  userId: string | null | undefined,
  emailByUserId: Map<string, string>,
  accountEmail?: string | null,
): string {
  if (userId) {
    const fromProfile = emailByUserId.get(userId);
    if (fromProfile) return fromProfile;
  }
  return (accountEmail ?? "").trim().toLowerCase();
}
