import type { SupabaseClient } from "@supabase/supabase-js";

/** Один активный поток поддержки на пользователя Subs Auth. */
export async function getOrCreateSubsCustomerSupportThread(
  subsAdmin: SupabaseClient,
  userId: string,
): Promise<{ id: string } | null> {
  return getOrCreateSubsStaffSupportThread(subsAdmin, { userId });
}

/** Поток поддержки для staff: по user_id и/или order_id (email-only заказы). */
export async function getOrCreateSubsStaffSupportThread(
  subsAdmin: SupabaseClient,
  opts: { userId?: string | null; orderId?: string | null },
): Promise<{ id: string } | null> {
  const userId = opts.userId?.trim() || null;
  const orderId = opts.orderId?.trim() || null;

  if (userId) {
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
        ...(orderId ? { order_id: orderId } : {}),
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

  if (!orderId) return null;

  try {
    const { data: openByOrder, error: openErr } = await subsAdmin
      .from("chat_threads")
      .select("id, status")
      .eq("order_id", orderId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!openErr && openByOrder?.id) {
      return { id: openByOrder.id as string };
    }

    const { data: anyByOrder } = await subsAdmin
      .from("chat_threads")
      .select("id, status")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (anyByOrder?.id) {
      if (anyByOrder.status !== "open") {
        await subsAdmin
          .from("chat_threads")
          .update({ status: "open", last_message_at: new Date().toISOString() })
          .eq("id", anyByOrder.id);
      }
      return { id: anyByOrder.id as string };
    }

    const { data: inserted, error: insErr } = await subsAdmin
      .from("chat_threads")
      .insert({
        user_id: null,
        order_id: orderId,
        status: "open",
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insErr || !inserted?.id) {
      console.error("[subs-chat-thread/order]", insErr?.message ?? "insert failed");
      return null;
    }

    return { id: inserted.id as string };
  } catch (e) {
    console.error("[subs-chat-thread/order] unexpected:", e);
    return null;
  }
}
