import type { SupabaseClient } from "@supabase/supabase-js";

import { getOrCreateClientOperatorSession } from "@/lib/chat/operatorSession";
import type { Database } from "@/types/database";

type Admin = SupabaseClient<Database>;

/**
 * Claim a guest operator session for a logged-in user.
 * On unique conflict (user already has a canonical session), move messages
 * into the canonical session and return that id — never leave the client on an orphan.
 */
export async function claimOrMergeGuestOperatorSession(
  admin: Admin,
  guestSessionId: string,
  userId: string,
  siteId: string | null,
): Promise<string | null> {
  const { data: existing, error: selectError } = await admin
    .from("chat_sessions")
    .select("id, user_id")
    .eq("id", guestSessionId)
    .eq("type", "operator")
    .eq("status", "open")
    .maybeSingle();

  if (selectError || !existing?.id) return null;

  if (existing.user_id === userId) {
    if (siteId) {
      await admin.from("chat_sessions").update({ site_id: siteId }).eq("id", existing.id);
    }
    return existing.id;
  }

  if (existing.user_id != null && existing.user_id !== userId) {
    return null;
  }

  const { error: claimErr } = await admin
    .from("chat_sessions")
    .update({
      user_id: userId,
      ...(siteId ? { site_id: siteId } : {}),
    })
    .eq("id", existing.id)
    .is("user_id", null);

  if (!claimErr) {
    return existing.id;
  }

  // Unique (user_id, site_id) conflict — merge into canonical.
  const canonical = await getOrCreateClientOperatorSession(admin, userId, "gpt-store");
  if (!canonical?.id) return existing.id;

  if (canonical.id === existing.id) return existing.id;

  await admin
    .from("chat_messages")
    .update({ session_id: canonical.id })
    .eq("session_id", existing.id);

  try {
    await admin
      .from("notifications")
      .update({ entity_id: canonical.id })
      .eq("entity_id", existing.id)
      .in("entity_type", ["chat", "chat_session", "support_chat"]);
  } catch {
    /* optional */
  }

  const { data: lastMsg } = await admin
    .from("chat_messages")
    .select("created_at")
    .eq("session_id", canonical.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await admin
    .from("chat_sessions")
    .update({
      last_message_at: lastMsg?.created_at ?? new Date().toISOString(),
      status: "open",
      ...(siteId ? { site_id: siteId } : {}),
    })
    .eq("id", canonical.id);

  // Close orphan guest session (messages already moved — no data loss).
  await admin
    .from("chat_sessions")
    .update({ status: "closed" })
    .eq("id", existing.id);

  return canonical.id;
}
