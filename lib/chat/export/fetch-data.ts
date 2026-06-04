import { mapSubsChatMessageToChatMessage } from "@/lib/admin/subs-chat-map";
import { formatDate } from "@/lib/chat/constants";
import { replyAuthorLabel, truncateForPreview } from "@/lib/chat/message-utils";
import { getSiteBySlug, type SiteSlug } from "@/lib/sites";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { ChatMessage } from "@/types";

import { parseMessageAttachments } from "./attachments";
import { authorForMessage, loadProfileEmails } from "./authors";
import type { ExportMessage, ExportMeta, ExportPayload } from "./types";

function parseDateBound(value: string | null, endOfDay: boolean): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(value.trim());
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay && value.trim().length <= 10) {
    d.setHours(23, 59, 59, 999);
  }
  return d;
}

function filterByPeriod(messages: ChatMessage[], dateFrom: string | null, dateTo: string | null): ChatMessage[] {
  const from = parseDateBound(dateFrom, false);
  const to = parseDateBound(dateTo, true);
  return messages.filter((m) => {
    const created = new Date(m.created_at);
    if (from && created < from) return false;
    if (to && created > to) return false;
    return true;
  });
}

function attachReplies(messages: ChatMessage[]): ChatMessage[] {
  const byId = new Map(messages.map((m) => [m.id, m]));
  return messages.map((m) => {
    const replyToId = m.reply_to_message_id ?? null;
    if (!replyToId) return m;
    const target = byId.get(replyToId);
    return {
      ...m,
      reply_to_message: target
        ? {
            id: target.id,
            sender_type: target.sender_type,
            content: target.content,
            is_deleted: target.is_deleted ?? false,
          }
        : { id: replyToId, sender_type: "auto" as const, content: "", is_deleted: true },
    };
  });
}

async function loadGptMessages(chatId: string): Promise<{ messages: ChatMessage[]; clientUserId: string | null }> {
  const { data: session } = await supabaseAdmin
    .from("chat_sessions")
    .select("user_id")
    .eq("id", chatId)
    .maybeSingle();

  const { data: rows, error } = await supabaseAdmin
    .from("chat_messages")
    .select("*")
    .eq("session_id", chatId)
    .order("created_at", { ascending: true })
    .limit(50000);

  if (error) throw new Error("Не удалось загрузить сообщения");
  return {
    messages: (rows ?? []) as ChatMessage[],
    clientUserId: (session as { user_id?: string | null } | null)?.user_id ?? null,
  };
}

async function loadSubsMessages(chatId: string): Promise<{ messages: ChatMessage[]; clientUserId: string | null }> {
  const subs = createSubsStoreAdminClient();
  if (!subs) throw new Error("SPOTIFY STORE не подключён");

  const { data: thread } = await subs.from("chat_threads").select("user_id").eq("id", chatId).maybeSingle();

  const { data: rows, error } = await subs
    .from("chat_messages")
    .select("*")
    .eq("thread_id", chatId)
    .order("created_at", { ascending: true })
    .limit(50000);

  if (error) throw new Error("Не удалось загрузить сообщения");

  const messages = (rows ?? []).map((row) =>
    mapSubsChatMessageToChatMessage(row as Parameters<typeof mapSubsChatMessageToChatMessage>[0]),
  );

  return {
    messages,
    clientUserId: (thread as { user_id?: string | null } | null)?.user_id ?? null,
  };
}

function periodLabel(dateFrom: string | null, dateTo: string | null): string {
  if (!dateFrom && !dateTo) return "весь чат";
  if (dateFrom && dateTo) return `${dateFrom} — ${dateTo}`;
  if (dateFrom) return `с ${dateFrom}`;
  return `до ${dateTo}`;
}

export async function buildExportPayload(params: {
  siteSlug: SiteSlug;
  chatId: string;
  dateFrom: string | null;
  dateTo: string | null;
}): Promise<ExportPayload> {
  const siteSlug = params.siteSlug === "subs-store" ? "subs-store" : "gpt-store";
  const loaded =
    siteSlug === "subs-store" ? await loadSubsMessages(params.chatId) : await loadGptMessages(params.chatId);

  const filtered = filterByPeriod(loaded.messages, params.dateFrom, params.dateTo);
  const withReplies = attachReplies(filtered);

  const profileDb = siteSlug === "subs-store" ? createSubsStoreAdminClient() : supabaseAdmin;
  if (!profileDb) throw new Error("База профилей недоступна");

  const senderIds = withReplies.map((m) => m.sender_id).filter(Boolean) as string[];
  if (loaded.clientUserId) senderIds.push(loaded.clientUserId);
  const profileEmails = await loadProfileEmails(profileDb, senderIds);

  const clientEmail = loaded.clientUserId ? profileEmails.get(loaded.clientUserId) ?? null : null;

  let staffEmail: string | null = null;
  for (const msg of withReplies) {
    if (msg.sender_type === "operator" || msg.sender_type === "admin") {
      const email = msg.sender_id ? profileEmails.get(msg.sender_id) ?? null : null;
      if (email) {
        staffEmail = email;
        break;
      }
    }
  }

  const exportMessages: ExportMessage[] = withReplies.map((msg) => ({
    ...msg,
    author: authorForMessage(msg, profileEmails, loaded.clientUserId),
    attachmentsList: msg.is_deleted ? [] : parseMessageAttachments(msg),
  }));

  const attachmentCount = exportMessages.reduce((n, m) => n + m.attachmentsList.length, 0);

  const meta: ExportMeta = {
    siteSlug,
    storeName: getSiteBySlug(siteSlug).brandName,
    chatId: params.chatId,
    clientEmail,
    staffEmail,
    exportDate: new Date().toLocaleString("ru-RU"),
    periodLabel: periodLabel(params.dateFrom, params.dateTo),
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    messageCount: exportMessages.length,
    attachmentCount,
  };

  return { meta, messages: exportMessages };
}

export function groupMessagesByDate(messages: ExportMessage[]): { date: string; messages: ExportMessage[] }[] {
  const grouped: { date: string; messages: ExportMessage[] }[] = [];
  for (const msg of messages) {
    const date = formatDate(msg.created_at);
    const last = grouped[grouped.length - 1];
    if (last && last.date === date) last.messages.push(msg);
    else grouped.push({ date, messages: [msg] });
  }
  return grouped;
}

export function formatExportTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function replyBlockHtml(msg: ExportMessage): string {
  const reply = msg.reply_to_message;
  if (!reply) return "";
  const role = replyAuthorLabel(reply);
  if (reply.is_deleted) {
    return `<div class="reply"><strong>Ответ на сообщение:</strong> исходное сообщение удалено</div>`;
  }
  const preview = truncateForPreview(reply.content || "—");
  return `<div class="reply"><strong>Ответ на сообщение:</strong> ${role}: ${preview.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
}
