import type { SupabaseClient } from "@supabase/supabase-js";

/** Один активный поток поддержки на пользователя Subs Auth. */
export async function getOrCreateSubsCustomerSupportThread(
  subsAdmin: SupabaseClient,
  userId: string,
): Promise<{ id: string } | null> {
  try {
    const { data: openRow, error: openErr } = await subsAdmin
      .from("chat_threads")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!openErr && openRow?.id) {
      return { id: openRow.id as string };
    }

    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      status: "open",
      last_message_at: new Date().toISOString(),
    };

    const { data: inserted, error: insErr } = await subsAdmin
      .from("chat_threads")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insErr || !inserted?.id) {
      console.error("[subs-chat-thread]", insErr?.message ?? "insert failed");
      return null;
    }

    return { id: inserted.id as string };
  } catch (e) {
    console.error("[subs-chat-thread] unexpected:", e);
    return null;
  }
}
