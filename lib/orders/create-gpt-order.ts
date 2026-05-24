import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

import { getSiteUUID } from "@/lib/admin/getSiteId";
import type { Database, Json } from "@/types/database";

type Admin = SupabaseClient<Database>;

export async function ensureGptProfile(admin: Admin, user: User): Promise<void> {
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existing) {
    await admin.from("profiles").insert({
      id: user.id,
      email: user.email ?? null,
      role: "client",
    });
    return;
  }

  if (user.email) {
    await admin.from("profiles").update({ email: user.email }).eq("id", user.id);
  }
}

export type CreateGptOrderInput = {
  userId: string;
  product: string;
  planId: string;
  price: number;
  accountEmail: string;
  paymentProvider?: string;
  meta?: Json | null;
};

export async function createGptStoreOrder(
  admin: Admin,
  input: CreateGptOrderInput,
): Promise<{ order: Database["public"]["Tables"]["orders"]["Row"] | null; error: string | null }> {
  const gptSiteId = await getSiteUUID("gpt-store");

  type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];

  const base: OrderInsert = {
    user_id: input.userId,
    product: input.product,
    plan_id: input.planId,
    price: input.price,
    status: "pending",
    account_email: input.accountEmail,
    payment_provider: input.paymentProvider ?? "pally",
    meta: input.meta ?? null,
    ...(gptSiteId ? { site_id: gptSiteId } : {}),
  };

  let res = await admin.from("orders").insert(base).select().single();

  if (res.error && gptSiteId && /site_id|foreign key/i.test(res.error.message)) {
    const { site_id: _drop, ...withoutSite } = base;
    res = await admin.from("orders").insert(withoutSite).select().single();
  }

  if (res.error) {
    return { order: null, error: res.error.message };
  }

  return { order: res.data, error: null };
}
