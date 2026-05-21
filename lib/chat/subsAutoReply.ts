import { mapSubsChatMessageToChatMessage } from "@/lib/admin/subs-chat-map";
import {
  getScriptedFaqAnswer,
  isQuickReplyFaqMessage,
  resolveSupportAutoReply,
  shouldSkipAutoReplyAfterStaffMessage,
} from "@/lib/chat/scriptedFaq";
import type { ChatMessage } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type SubsAdmin = SupabaseClient;

/**
 * Вставляет автоответ Subs Store после сообщения клиента (FAQ + эскалация к оператору).
 */
export async function insertSubsStoreChatAutoReply(
  admin: SubsAdmin,
  threadId: string,
  customerContent: string,
): Promise<ChatMessage | null> {
  const { data: lastStaff } = await admin
    .from("chat_messages")
    .select("created_at")
    .eq("thread_id", threadId)
    .in("author_role", ["operator", "admin"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isFaqButton = isQuickReplyFaqMessage(customerContent);
  const lastStaffAt = (lastStaff as { created_at?: string } | null)?.created_at ?? null;

  if (!isFaqButton && shouldSkipAutoReplyAfterStaffMessage(lastStaffAt)) {
    return null;
  }

  const replyText = resolveSupportAutoReply(customerContent, "subs-store");

  if (!isFaqButton && !getScriptedFaqAnswer(customerContent) && lastStaffAt) {
    const lower = customerContent.toLowerCase();
    const wantsHuman = /оператор|человек|менеджер|живой/.test(lower);
    if (!wantsHuman) return null;
  }

  const tryRoles = ["system", "operator"] as const;

  for (const authorRole of tryRoles) {
    const { data: autoRow, error } = await admin
      .from("chat_messages")
      .insert({
        thread_id: threadId,
        author_id: null,
        author_role: authorRole,
        content: replyText,
      })
      .select("*")
      .single();

    if (!error && autoRow) {
      return mapSubsChatMessageToChatMessage(
        autoRow as Parameters<typeof mapSubsChatMessageToChatMessage>[0],
      );
    }
  }

  return null;
}
