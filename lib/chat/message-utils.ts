import type { ChatMessage, ChatSenderType } from "@/types";

export function isIncomingUnread(
  msg: ChatMessage,
  viewerIsStaff: boolean,
): boolean {
  if (viewerIsStaff) {
    return msg.sender_type === "client" && !msg.is_read;
  }
  return ["operator", "admin", "auto", "ai"].includes(msg.sender_type) && !msg.is_read;
}

export function firstUnreadMessageId(
  messages: ChatMessage[],
  viewerIsStaff: boolean,
): string | null {
  const idx = messages.findIndex((m) => isIncomingUnread(m, viewerIsStaff));
  if (idx < 0) return null;
  return messages[idx]?.id ?? null;
}

export function replyAuthorLabel(
  msg: Pick<ChatMessage, "sender_type"> & { is_auto_reply?: boolean },
  opts?: { selfLabel?: string },
): string {
  const t = msg.sender_type as ChatSenderType;
  if (t === "client") return "Клиент";
  if (t === "operator") return "Оператор";
  if (t === "admin") return "Админ";
  if (t === "auto" || msg.is_auto_reply) return "Поддержка";
  if (t === "ai") return "AI";
  return opts?.selfLabel ?? "Сообщение";
}

export function truncateForPreview(text: string, max = 120): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
