"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { OPERATOR_CHAT_QUICK_REPLIES } from "@/lib/chat/scriptedFaq";
import { MAX_CHAT_MESSAGE_LENGTH, getMessageLengthError, isBlankMessage } from "@/lib/chat/message-validation";
import type { ChatMessage, ChatSenderType } from "@/types";

interface Props {
  sessionId: string;
  userId: string;
  initialMessages?: ChatMessage[];
  /** Пишет в чат сотрудник (из того же дашборда) — визуал «свои» пузыри и optimistic sender_type. */
  replyAsOperator?: boolean;
}

export function OperatorChat({ sessionId, userId, initialMessages = [], replyAsOperator = false }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);
  const [loadingMessages, setLoadingMessages] = useState(initialMessages.length === 0);
  const [inputError, setInputError] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const forceScrollRef = useRef(false);
  const lastSeenMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    isSendingRef.current = isSending;
  }, [isSending]);

  useEffect(() => {
    let stopped = false;

    const loadMessages = async () => {
      if (isSendingRef.current) return;
      try {
        const response = await fetch(
          `/api/chat/operator/guest/messages?userId=${encodeURIComponent(userId)}`
        );
        const payload = (await response.json()) as { messages?: ChatMessage[] };

        if (!stopped && response.ok) {
          const nextMessages = payload.messages ?? [];
          setMessages(nextMessages);
        }
      } finally {
        if (!stopped) {
          setLoadingMessages(false);
        }
      }
    };

    // Always refresh once in background to ensure we have the latest state.
    void loadMessages();
    const poll = setInterval(() => {
      void loadMessages();
    }, 5000);

    return () => {
      stopped = true;
      clearInterval(poll);
    };
  }, [sessionId, userId]);

  const isNearBottom = () => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceToBottom < 120;
  };

  useEffect(() => {
    const lastMessageId = messages.at(-1)?.id ?? null;
    const hasNewMessage = lastMessageId !== null && lastMessageId !== lastSeenMessageIdRef.current;

    if (forceScrollRef.current || (hasNewMessage && isNearBottom())) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    forceScrollRef.current = false;
    lastSeenMessageIdRef.current = lastMessageId;
  }, [messages]);

  async function sendMessage(text: string) {
    if (isSending) return;
    if (isBlankMessage(text)) return;
    const content = text;
    const contentLengthError = getMessageLengthError(content);
    if (contentLengthError) {
      setInputError(contentLengthError);
      return;
    }
    setInput("");
    setInputError(null);
    setIsSending(true);
    isSendingRef.current = true;
    forceScrollRef.current = true;

    const outgoingType: ChatSenderType = replyAsOperator ? "operator" : "client";

    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      sender_id: userId,
      sender_type: outgoingType,
      content,
      attachments: null,
      is_read: false,
      is_auto_reply: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const response = await fetch("/api/chat/operator/guest/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, content }),
      });

      if (!response.ok) {
        throw new Error("send failed");
      }

      const refreshed = await fetch(
        `/api/chat/operator/guest/messages?userId=${encodeURIComponent(userId)}`
      );
      const payload = (await refreshed.json()) as { messages?: ChatMessage[] };
      if (refreshed.ok) {
        setMessages(payload.messages ?? []);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          session_id: sessionId,
          sender_id: null,
          sender_type: "auto",
          content: "Не удалось отправить сообщение. Попробуйте еще раз.",
          attachments: null,
          is_read: false,
          is_auto_reply: true,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }

  const isOwnBubble = (msg: ChatMessage) => {
    if (msg.sender_id) return msg.sender_id === userId;
    if (msg.sender_type === "client" || msg.sender_type === "operator") {
      return msg.sender_type === (replyAsOperator ? "operator" : "client");
    }
    return false;
  };

  const senderColor = (type: string) => {
    if (type === "client") return "bg-[#10a37f] text-white";
    if (type === "ai") return "bg-blue-100 text-blue-800";
    if (type === "auto") return "bg-gray-100 text-gray-600 italic";
    if (type === "operator") return "bg-gray-100 text-gray-800";
    if (type === "admin") return "bg-amber-50 text-amber-900";
    return "bg-gray-100 text-gray-800";
  };

  const senderLabel = (type: string) => {
    if (type === "operator") return "Оператор";
    if (type === "admin") return "Админ";
    if (type === "ai") return "AI помощник";
    if (type === "auto") return "Авто-ответ";
    return null;
  };

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="bg-[#10a37f] px-4 pb-3 pt-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
              G
            </div>
            <div>
              <p className="text-sm font-semibold text-white">GPT STORE — поддержка</p>
              <p className="text-xs text-white/80">На связи</p>
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-white/15 p-0.5">
            <div className="rounded-md bg-white py-1.5 text-center text-xs font-medium text-[#10a37f]">
              Оператор
            </div>
          </div>
        </div>

        <div
          ref={messagesContainerRef}
          className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4"
        >
          {loadingMessages && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 size={14} className="animate-spin" />
              Загружаем сообщения...
            </div>
          )}
          {messages.length === 0 && (
            <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
              Напишите сообщение, оператор ответит в этом чате.
            </div>
          )}

          {messages.map((msg) => {
            const isOwnMessage = isOwnBubble(msg);
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex", isOwnMessage ? "justify-end" : "justify-start")}
              >
                <div className="max-w-[82%]">
                  {!isOwnMessage && senderLabel(msg.sender_type) && (
                    <p className="mb-1 text-[10px] font-semibold text-gray-400">
                      {senderLabel(msg.sender_type)}
                      {msg.is_auto_reply && " (авто)"}
                    </p>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]",
                      isOwnMessage
                        ? "bg-[#10a37f] text-white"
                        : senderColor(msg.sender_type)
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="sticky bottom-0 z-20 bg-white">
          {!replyAsOperator && (
            <div className="border-t border-black/[0.06] px-3 py-2">
              <div className="flex flex-wrap gap-1.5 pb-1 md:flex-nowrap md:overflow-x-auto md:[&::-webkit-scrollbar]:hidden">
                {OPERATOR_CHAT_QUICK_REPLIES.map(({ label, message }) => (
                  <button
                    key={message}
                    type="button"
                    onClick={() => sendMessage(message)}
                    className="max-w-full rounded-full border border-[#10a37f]/30 px-3 py-1.5 text-xs font-medium text-[#10a37f] transition-colors hover:bg-[#10a37f]/10 md:shrink-0"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-black/[0.06] p-3">
            {inputError && <p className="mb-2 text-xs text-red-500">{inputError}</p>}
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (inputError) setInputError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage(input);
                  }
                }}
                placeholder="Напишите оператору..."
                rows={1}
                maxLength={MAX_CHAT_MESSAGE_LENGTH}
                className="max-h-32 min-h-[38px] flex-1 resize-none overflow-y-auto rounded-xl border border-black/[0.1] px-3 py-2 text-sm outline-none focus:border-[#10a37f] focus:ring-2 focus:ring-[#10a37f]/20"
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                }}
              />
              <button
                type="submit"
                disabled={isSending || isBlankMessage(input)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#10a37f] text-white disabled:opacity-40"
              >
                {isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </form>
            {input.length > MAX_CHAT_MESSAGE_LENGTH * 0.8 && (
              <p className="mt-1 text-right text-[11px] text-gray-400">
                {input.length}/{MAX_CHAT_MESSAGE_LENGTH}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
