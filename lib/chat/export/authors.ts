import type { SupabaseClient } from "@supabase/supabase-js";

import { replyAuthorLabel } from "@/lib/chat/message-utils";
import type { ChatMessage } from "@/types";

export type ProfileEmailRow = { id: string; email: string | null };

export async function loadProfileEmails(
  db: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string | null>();
  if (unique.length === 0) return map;

  const { data } = await db.from("profiles").select("id, email").in("id", unique);
  for (const row of (data ?? []) as ProfileEmailRow[]) {
    map.set(row.id, row.email ?? null);
  }
  return map;
}

export function authorForMessage(
  msg: ChatMessage,
  profileEmails: Map<string, string | null>,
  clientUserId: string | null,
): { roleLabel: string; email: string | null } {
  const roleLabel = replyAuthorLabel(msg, { selfLabel: "Система" });
  if (msg.sender_type === "auto" || msg.sender_type === "ai" || msg.is_auto_reply) {
    return { roleLabel: msg.sender_type === "ai" ? "AI" : "Система", email: null };
  }
  if (msg.sender_id) {
    return { roleLabel, email: profileEmails.get(msg.sender_id) ?? null };
  }
  if (msg.sender_type === "client" && clientUserId) {
    return { roleLabel, email: profileEmails.get(clientUserId) ?? null };
  }
  return { roleLabel, email: null };
}
