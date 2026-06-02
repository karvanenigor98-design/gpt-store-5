import type { ChatMessage } from "@/types";
import type { ChatSenderType } from "@/types/database";

/** Map Subs Store author_role to GPT ChatMessage sender_type for shared UI */
export function subsAuthorRoleToSenderType(role: string): ChatSenderType {
  const r = (role ?? "").toLowerCase();
  if (r === "customer") return "client";
  if (r === "system" || r === "auto" || r === "bot") return "auto";
  if (r === "operator") return "operator";
  if (r === "admin" || r === "super_admin") return "admin";
  return "client";
}

export function mapSubsChatMessageToChatMessage(row: {
  id: string;
  thread_id: string;
  author_id: string | null;
  author_role: string;
  content: string;
  attachment_url: string | null;
  attachment_type: string | null;
  read_at: string | null;
  reply_to_message_id?: string | null;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at: string;
}): ChatMessage {
  const attachments =
    row.attachment_url ?
      [{ url: row.attachment_url, type: row.attachment_type ?? "file", name: "вложение" }]
    : null;
  return {
    id: row.id,
    session_id: row.thread_id,
    sender_id: row.author_id,
    sender_type: subsAuthorRoleToSenderType(row.author_role),
    content: row.content,
    attachments,
    is_read: Boolean(row.read_at),
    is_auto_reply: ["system", "auto", "bot"].includes((row.author_role ?? "").toLowerCase()),
    reply_to_message_id: row.reply_to_message_id ?? null,
    is_deleted: Boolean(row.is_deleted),
    deleted_at: row.deleted_at ?? null,
    deleted_by: row.deleted_by ?? null,
    created_at: row.created_at,
  };
}
