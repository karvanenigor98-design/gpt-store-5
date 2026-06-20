"use client";

import type { ChatMessage } from "@/types";
import { formatTime, isImageType } from "@/lib/chat/constants";
import { cn } from "@/lib/utils";
import { CornerDownRight, MoreVertical } from "lucide-react";
import { replyAuthorLabel, truncateForPreview } from "@/lib/chat/message-utils";

export type ChatUiVariant = "gpt" | "subs";

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  variant?: ChatUiVariant;
  canModerate?: boolean;
  onReply?: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
  onJumpToMessage?: (messageId: string) => void;
  highlight?: boolean;
}

type Attachment = { url?: string; type?: string; name?: string };

function getAttachment(m: ChatMessage): Attachment | null {
  if (!m.attachments || typeof m.attachments !== "object") return null;
  const a = m.attachments as Record<string, unknown>;
  const url = typeof a.url === "string" ? a.url : null;
  if (!url) return null;
  return {
    url,
    type: typeof a.type === "string" ? a.type : undefined,
    name: typeof a.name === "string" ? a.name : undefined,
  };
}

function senderLabel(msg: ChatMessage): string {
  if (msg.sender_type === "ai") return "AI";
  if (msg.sender_type === "auto" || msg.is_auto_reply) return "Авто-ответ";
  if (msg.sender_type === "operator") return "Оператор";
  if (msg.sender_type === "admin") return "Админ";
  if (msg.sender_type === "client") return "Клиент";
  return "";
}

function avatarLetter(msg: ChatMessage): string {
  const label = senderLabel(msg);
  if (label === "AI") return "AI";
  if (!label) return "?";
  return label.slice(0, 1).toUpperCase();
}

export function MessageBubble({
  message,
  isOwn,
  variant = "gpt",
  canModerate = false,
  onReply,
  onDelete,
  onJumpToMessage,
  highlight = false,
}: MessageBubbleProps) {
  const isSubs = variant === "subs";
  const isAI = message.sender_type === "ai";
  const isAuto = message.sender_type === "auto" || message.is_auto_reply;
  const label = !isOwn ? senderLabel(message) : null;
  const att = getAttachment(message);
  const canShowMenu = Boolean(onReply) || (canModerate && Boolean(onDelete));

  return (
    <div
      className={cn("flex max-w-[80%] gap-2", isOwn ? "ml-auto flex-row-reverse" : "mr-auto")}
    >
      {!isOwn && (
        <div
          className={cn(
            "mt-auto flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold",
            isAI
              ? isSubs
                ? "bg-violet-500/20 text-violet-200"
                : "bg-violet-100 text-violet-700"
              : isAuto
                ? isSubs
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "bg-emerald-100 text-emerald-800"
                : isSubs
                  ? "bg-[#1DB954]/20 text-[#1DB954]"
                  : "bg-blue-100 text-blue-700",
          )}
        >
          {isAI ? "AI" : avatarLetter(message)}
        </div>
      )}

      <div
        className={cn(
          "group relative flex min-w-0 flex-col gap-0.5 rounded-xl",
          highlight && (isSubs ? "ring-1 ring-[#1DB954]/55" : "ring-1 ring-[#10a37f]/50"),
        )}
      >
        {!isOwn && label && (
          <span className={cn("px-1 text-xs", isSubs ? "text-gray-500" : "text-gray-400")}>{label}</span>
        )}

        <div
          className={cn(
            "break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isOwn
              ? isSubs
                ? "rounded-tr-sm bg-[#1DB954] text-white"
                : "rounded-tr-sm bg-[#10a37f] text-white"
              : isAI
                ? isSubs
                  ? "rounded-tl-sm border border-violet-500/25 bg-violet-500/10 text-violet-100"
                  : "rounded-tl-sm border border-violet-100 bg-violet-50 text-violet-900"
                : isAuto
                  ? isSubs
                    ? "rounded-tl-sm border border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                    : "rounded-tl-sm border border-emerald-100 bg-emerald-50 text-emerald-900"
                  : isSubs
                    ? "rounded-tl-sm border border-white/10 bg-[#1c1c1c] text-gray-100"
                    : "rounded-tl-sm border border-gray-100 bg-white text-gray-800 shadow-sm",
          )}
        >
          {message.reply_to_message && (
            <button
              type="button"
              onClick={() => {
                if (message.reply_to_message?.id) onJumpToMessage?.(message.reply_to_message.id);
              }}
              className={cn(
                "mb-2 flex w-full gap-1.5 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors hover:opacity-90",
                isSubs ? "border-white/10 bg-black/25 text-gray-300" : "border-black/10 bg-black/5 text-gray-600",
                onJumpToMessage && "cursor-pointer",
              )}
            >
              <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="min-w-0">
                <span className="block font-semibold opacity-80">
                  {replyAuthorLabel(message.reply_to_message, { selfLabel: "Вы" })}
                </span>
                <span className="line-clamp-2">
                  {message.reply_to_message.is_deleted
                    ? "Сообщение удалено"
                    : truncateForPreview(message.reply_to_message.content ?? "")}
                </span>
              </span>
            </button>
          )}
          {att?.url && (
            <div className="mb-2">
              {att.type && isImageType(att.type) ? (
                <img
                  src={att.url}
                  alt={att.name ?? "Изображение"}
                  className="max-h-[200px] max-w-[240px] cursor-pointer rounded-lg object-cover"
                  onClick={() => window.open(att.url, "_blank", "noopener,noreferrer")}
                />
              ) : (
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-2 text-sm underline",
                    isOwn ? "text-white/90" : isSubs ? "text-[#1DB954]" : "text-blue-600",
                  )}
                >
                  {att.name ?? "Файл"}
                </a>
              )}
            </div>
          )}

          {message.content && <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{message.content}</span>}
        </div>

        {canShowMenu && (
          <div
            className={cn(
              "absolute -top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100",
              isOwn ? "-left-8" : "-right-8",
            )}
          >
            <details className="relative">
              <summary className="list-none cursor-pointer rounded-md border border-black/10 bg-white/90 p-1 text-gray-500 hover:bg-white">
                <MoreVertical className="h-3.5 w-3.5" />
              </summary>
              <div
                className={cn(
                  "absolute mt-1 min-w-[120px] rounded-md border border-black/10 bg-white p-1 shadow-lg",
                  isOwn ? "right-0" : "left-0",
                )}
              >
                {onReply && (
                  <button
                    type="button"
                    onClick={() => onReply(message)}
                    className="block w-full rounded px-2 py-1 text-left text-xs text-gray-700 hover:bg-gray-100"
                  >
                    Ответить
                  </button>
                )}
                {canModerate && onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(message)}
                    className="block w-full rounded px-2 py-1 text-left text-xs text-red-600 hover:bg-red-50"
                  >
                    Удалить
                  </button>
                )}
              </div>
            </details>
          </div>
        )}

        <div
          className={cn("flex items-center gap-1 px-1", isOwn ? "justify-end" : "justify-start")}
        >
          <span className={cn("text-xs", isSubs ? "text-gray-600" : "text-gray-400")}>
            {formatTime(message.created_at)}
          </span>
          {isOwn && (
            <span className={cn("text-xs", isSubs ? "text-gray-600" : "text-gray-400")}>
              {message.is_read ? "✓✓" : "✓"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
