"use client";

import type { ChatMessage } from "@/types";
import { formatTime, isImageType, sanitizeText } from "@/lib/chat/constants";
import { cn } from "@/lib/utils";

export type ChatUiVariant = "gpt" | "subs";

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  variant?: ChatUiVariant;
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

export function MessageBubble({ message, isOwn, variant = "gpt" }: MessageBubbleProps) {
  const isSubs = variant === "subs";
  const isAI = message.sender_type === "ai";
  const isAuto = message.sender_type === "auto" || message.is_auto_reply;
  const label = !isOwn ? senderLabel(message) : null;
  const att = getAttachment(message);

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

      <div className="flex min-w-0 flex-col gap-0.5">
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

          {message.content && (
            <span
              dangerouslySetInnerHTML={{
                __html: sanitizeText(message.content).replace(/\n/g, "<br/>"),
              }}
            />
          )}
        </div>

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
