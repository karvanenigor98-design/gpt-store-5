"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage, Profile } from "@/types";
import { MessageBubble, type ChatUiVariant } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { formatDate } from "@/lib/chat/constants";
import {
  FAQ_QUICK_REPLY_DELAY_MS,
  getInstantFaqAnswer,
  OPERATOR_CHAT_QUICK_REPLIES,
} from "@/lib/chat/scriptedFaq";
import { playChatMessagePing } from "@/lib/admin/notification-sound";
import { refreshStaffNavBadges } from "@/lib/admin/staff-nav-badges-client";
import { cn } from "@/lib/utils";
import type { ChatRoomListItem } from "@/types/chat-ui";

type RoomStatus = NonNullable<ChatRoomListItem["status"]> | "open" | "closed" | "waiting";

interface ChatWindowProps {
  currentUser: Profile;
  sessionId: string;
  roomStatus?: RoomStatus;
  otherPartyName?: string;
  /** Для подзаголовка: клиент в ЛК или сотрудник в админке */
  viewerIsStaff: boolean;
  /** При выборе Subs Store в общей админке — отдельный API и БД */
  siteSlug?: string;
  /** Скрыть шапку (если заголовок уже в родителе, напр. боковая панель) */
  hideHeader?: boolean;
}

function messageIsOwn(msg: ChatMessage, currentUserId: string, viewerIsStaff: boolean, siteSlug?: string): boolean {
  if (msg.sender_id && msg.sender_id === currentUserId) return true;
  if (
    siteSlug === "subs-store" &&
    viewerIsStaff &&
    (msg.sender_type === "operator" || msg.sender_type === "admin")
  ) {
    return true;
  }
  return false;
}

export function ChatWindow({
  currentUser,
  sessionId,
  roomStatus = "open",
  otherPartyName,
  viewerIsStaff,
  siteSlug,
  hideHeader = false,
}: ChatWindowProps) {
  /** Тёмная тема Subs — только клиентский кабинет; в админке всегда светлый GPT-стиль */
  const isSubsClient = siteSlug === "subs-store" && !viewerIsStaff;
  const chatVariant: ChatUiVariant = isSubsClient ? "subs" : "gpt";
  const isSubs = chatVariant === "subs";
  const accent = siteSlug === "subs-store" ? "#1DB954" : "#10a37f";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerPulse, setHeaderPulse] = useState(false);
  const [faqTyping, setFaqTyping] = useState(false);
  const [faqSending, setFaqSending] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const forceScrollRef = useRef(false);
  const lastSeenMessageIdRef = useRef<string | null>(null);
  const supabase = createClient();

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  const isNearBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceToBottom < 120;
  }, []);

  const loadMessages = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const isSubs = siteSlug === "subs-store";
      const url =
        isSubs && viewerIsStaff
          ? `/api/admin/subs-store/chat/messages?thread_id=${encodeURIComponent(sessionId)}`
          : isSubs
            ? `/api/subs/chat/messages?thread_id=${encodeURIComponent(sessionId)}`
            : `/api/chat/messages?session_id=${encodeURIComponent(sessionId)}`;
      const res = await fetch(url, { credentials: "include" });
      const data = (await res.json()) as {
        messages?: ChatMessage[];
        error?: string;
        ok?: boolean;
        code?: string;
      };
      if (!res.ok) {
        const hint =
          data.error ??
          (isSubs ?
            `Ошибка API Subs чата (${data.code ?? "?"}): проверьте NEXT_PUBLIC_SUBS_* env и таблицы в Subs-проекте.`
          : undefined);
        throw new Error(hint ?? "Ошибка загрузки");
      }
      setMessages(data.messages ?? []);
      if (viewerIsStaff) {
        refreshStaffNavBadges();
      }
    } catch (e: unknown) {
      if (!silent) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки сообщений");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [sessionId, siteSlug, viewerIsStaff]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const lastMessageId = messages.at(-1)?.id ?? null;
    const hasNewMessage = lastMessageId !== null && lastMessageId !== lastSeenMessageIdRef.current;

    if (messages.length > 0 && (forceScrollRef.current || (hasNewMessage && isNearBottom()))) {
      scrollToBottom(messages.length > 1);
    }

    forceScrollRef.current = false;
    lastSeenMessageIdRef.current = lastMessageId;
  }, [messages, scrollToBottom, isNearBottom]);

  useEffect(() => {
    if (siteSlug === "subs-store") return;

    const channel = supabase
      .channel(`chat-session:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as ChatMessage;
          if (
            !viewerIsStaff &&
            row?.sender_type &&
            ["operator", "admin"].includes(row.sender_type) &&
            row.sender_id !== currentUser.id
          ) {
            setHeaderPulse(true);
            window.setTimeout(() => setHeaderPulse(false), 1600);
            if (typeof document !== "undefined" && document.hidden) {
              playChatMessagePing();
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                try {
                  new Notification("GPT STORE — новое сообщение", {
                    body: (row.content ?? "").slice(0, 140) || "Ответ поддержки",
                    tag: `chat-${sessionId}`,
                  });
                } catch {
                  /* noop */
                }
              }
            }
          }
          void loadMessages({ silent: true });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, supabase, loadMessages, viewerIsStaff, currentUser.id, siteSlug]);

  useEffect(() => {
    if (viewerIsStaff || typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      void Notification.requestPermission().catch(() => {});
    }
  }, [viewerIsStaff]);

  /** Резерв, если Realtime не доставляет события (репликация / RLS). */
  useEffect(() => {
    const t = window.setInterval(() => {
      void loadMessages({ silent: true });
    }, 4000);
    return () => window.clearInterval(t);
  }, [sessionId, loadMessages, siteSlug]);

  const mergeById = useCallback((prev: ChatMessage[], additions: ChatMessage[]) => {
    const map = new Map<string, ChatMessage>();
    for (const m of prev) map.set(m.id, m);
    for (const m of additions) map.set(m.id, m);
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, []);

  const postChatMessage = useCallback(
    async (text: string, attachment?: { url: string; type: string; name: string }) => {
      const isSubs = siteSlug === "subs-store";
      const subsStaff = isSubs && viewerIsStaff;
      const res = await fetch(
        subsStaff
          ? "/api/admin/subs-store/chat/messages"
          : isSubs
            ? "/api/subs/chat/messages"
            : "/api/chat/messages",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(
            isSubs
              ? { thread_id: sessionId, content: text.trim() }
              : {
                  session_id: sessionId,
                  content: text.trim(),
                  attachment: attachment ?? null,
                },
          ),
        },
      );
      const data = (await res.json()) as {
        error?: string;
        message?: ChatMessage;
        autoReply?: ChatMessage | null;
      };
      if (!res.ok) throw new Error(data.error ?? "Ошибка отправки");
      return data;
    },
    [sessionId, siteSlug, viewerIsStaff],
  );

  const handleSend = async (
    text: string,
    attachment?: { url: string; type: string; name: string },
  ) => {
    const data = await postChatMessage(text, attachment);
    const toAdd: ChatMessage[] = [];
    if (data.message) toAdd.push(data.message);
    if (data.autoReply) toAdd.push(data.autoReply);
    if (toAdd.length) {
      forceScrollRef.current = true;
      setMessages((prev) => mergeById(prev, toAdd));
      scrollToBottom(true);
    }
    void loadMessages({ silent: true });
  };

  /** Кнопки FAQ: сразу вопрос клиента, через ~1 с — автоответ, параллельно сохранение в БД. */
  const handleQuickFaqClick = async (faqMessage: string) => {
    if (faqSending || closed || viewerIsStaff) return;

    const site = siteSlug === "subs-store" ? "subs-store" : "gpt-store";
    const instantAnswer = getInstantFaqAnswer(faqMessage, site);
    if (!instantAnswer) {
      await handleSend(faqMessage);
      return;
    }

    setFaqSending(true);
    const now = new Date().toISOString();
    const tempUserId = `temp-user-${Date.now()}`;
    const tempAutoId = `temp-auto-${Date.now() + 1}`;

    const optimisticUser: ChatMessage = {
      id: tempUserId,
      session_id: sessionId,
      sender_id: currentUser.id,
      sender_type: "client",
      content: faqMessage,
      attachments: null,
      is_read: false,
      is_auto_reply: false,
      created_at: now,
    };

    forceScrollRef.current = true;
    setMessages((prev) => mergeById(prev, [optimisticUser]));
    scrollToBottom(true);
    setFaqTyping(true);

    await new Promise((r) => window.setTimeout(r, FAQ_QUICK_REPLY_DELAY_MS));

    const optimisticAuto: ChatMessage = {
      id: tempAutoId,
      session_id: sessionId,
      sender_id: null,
      sender_type: "auto",
      content: instantAnswer,
      attachments: null,
      is_read: true,
      is_auto_reply: true,
      created_at: new Date().toISOString(),
    };

    setFaqTyping(false);
    setMessages((prev) => mergeById(prev, [optimisticAuto]));
    scrollToBottom(true);

    try {
      const data = await postChatMessage(faqMessage);
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempUserId && m.id !== tempAutoId);
        const adds: ChatMessage[] = [];
        if (data.message) adds.push(data.message);
        if (data.autoReply) adds.push(data.autoReply);
        else adds.push(optimisticAuto);
        return mergeById(withoutTemp, adds);
      });
      scrollToBottom(true);
      void loadMessages({ silent: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Не удалось отправить сообщение");
    } finally {
      setFaqSending(false);
      setFaqTyping(false);
    }
  };

  const grouped: { date: string; messages: ChatMessage[] }[] = [];
  for (const msg of messages) {
    const date = formatDate(msg.created_at);
    const last = grouped[grouped.length - 1];
    if (last && last.date === date) last.messages.push(msg);
    else grouped.push({ date, messages: [msg] });
  }

  const closed = roomStatus === "closed";

  return (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden",
        isSubs && "bg-[#111111]",
      )}
    >
      {!hideHeader && (
      <div
        className={cn(
          "flex items-center gap-3 border-b px-3 py-3 transition-colors sm:px-4",
          isSubs
            ? headerPulse
              ? "border-[#1DB954]/40 bg-[#1DB954]/10"
              : "border-white/10 bg-[#161616]"
            : headerPulse
              ? "border-[#10a37f]/40 bg-[#10a37f]/8"
              : "border-gray-100 bg-white",
        )}
      >
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-transform",
            viewerIsStaff
              ? isSubs
                ? "bg-amber-500/20 text-amber-200"
                : "bg-amber-100 text-amber-800"
              : isSubs
                ? "bg-[#1DB954]/20 text-[#1DB954]"
                : "bg-[#10a37f]/15 text-[#10a37f]",
            headerPulse && !viewerIsStaff && "scale-110 motion-safe:animate-pulse",
          )}
        >
          {viewerIsStaff ? "К" : siteSlug === "subs-store" ? "S" : "G"}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm font-semibold", isSubs ? "text-white" : "text-gray-900")}>
            {otherPartyName ??
              (viewerIsStaff ? "Клиент" : siteSlug === "subs-store" ? "SPOTIFY STORE — поддержка" : "GPT STORE — поддержка")}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                roomStatus === "open"
                  ? isSubs
                    ? "bg-[#1DB954]"
                    : "bg-green-500"
                  : roomStatus === "waiting"
                    ? "bg-amber-400"
                    : isSubs
                      ? "bg-gray-600"
                      : "bg-gray-300",
              )}
            />
            <span className={cn("text-xs", isSubs ? "text-gray-500" : "text-gray-400")}>
              {roomStatus === "open"
                ? "Активен"
                : roomStatus === "waiting"
                  ? "Ожидает ответа"
                  : roomStatus === "closed"
                    ? "Закрыт"
                    : "Чат"}
            </span>
          </div>
        </div>
      </div>
      )}

      <div
        ref={messagesContainerRef}
        className={cn(
          "min-h-0 flex-1 space-y-4 overflow-y-auto p-3 sm:p-4",
          isSubs ? "bg-[#0d0d0d]" : "bg-gray-50",
        )}
      >
        {loading && (
          <div className="flex h-full items-center justify-center">
            <div className={cn("flex flex-col items-center gap-2", isSubs ? "text-gray-500" : "text-gray-400")}>
              <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              <span className="text-sm">Загрузка...</span>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <p className="text-sm text-red-400">{error}</p>
            <button
              type="button"
              onClick={() => void loadMessages()}
              className={cn(
                "text-sm underline",
                isSubs ? "text-[#1DB954] hover:text-[#1ed760]" : "text-[#10a37f] hover:text-[#0d8f68]",
              )}
            >
              Повторить
            </button>
          </div>
        )}

        {!loading && !error && messages.length === 0 && (
          <div
            className={cn(
              "flex h-full flex-col items-center justify-center gap-2",
              isSubs ? "text-gray-500" : "text-gray-400",
            )}
          >
            <p className="text-sm">Нет сообщений. Начните диалог.</p>
          </div>
        )}

        {!loading &&
          !error &&
          grouped.map(({ date, messages: dayMsgs }) => (
            <div key={date} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={cn("h-px flex-1", isSubs ? "bg-white/10" : "bg-gray-200")} />
                <span
                  className={cn(
                    "px-2 text-xs",
                    isSubs ? "bg-[#0d0d0d] text-gray-500" : "bg-gray-50 text-gray-400",
                  )}
                >
                  {date}
                </span>
                <div className={cn("h-px flex-1", isSubs ? "bg-white/10" : "bg-gray-200")} />
              </div>
              {dayMsgs.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={messageIsOwn(msg, currentUser.id, viewerIsStaff, siteSlug)}
                  variant={chatVariant}
                />
              ))}
            </div>
          ))}

        {faqTyping && !viewerIsStaff && (
          <div
            className={cn(
              "flex items-center gap-2 px-1 text-xs",
              isSubs ? "text-gray-500" : "text-gray-500",
            )}
          >
            <span
              className="inline-flex h-2 w-2 animate-pulse rounded-full"
              style={{ backgroundColor: accent }}
            />
            Поддержка печатает…
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className={cn("sticky bottom-0 z-20", isSubs ? "bg-[#111111]" : "bg-white")}>
        {!error && !viewerIsStaff && !closed && (
          <div
            className={cn(
              "border-t px-3 pt-2",
              isSubs ? "border-white/10 bg-[#111111]" : "border-gray-100 bg-white",
            )}
          >
            <div className="flex flex-wrap gap-1.5 pb-2 md:flex-nowrap md:overflow-x-auto md:[-ms-overflow-style:none] md:[scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden">
              {OPERATOR_CHAT_QUICK_REPLIES.map(({ label, message }) => (
                <button
                  key={message}
                  type="button"
                  disabled={faqSending}
                  onClick={() => void handleQuickFaqClick(message)}
                  className="max-w-full rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 md:shrink-0"
                  style={{
                    borderColor: `${accent}59`,
                    color: accent,
                    backgroundColor: isSubs ? "transparent" : "white",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${accent}1a`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isSubs ? "transparent" : "white";
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <ChatInput
          onSend={handleSend}
          disabled={closed}
          placeholder={closed ? "Чат закрыт" : "Напишите сообщение…"}
          variant={chatVariant}
        />
      </div>
    </div>
  );
}
