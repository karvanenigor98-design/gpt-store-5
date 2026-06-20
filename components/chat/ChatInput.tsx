"use client";

import { useState, useRef, useEffect, type ChangeEvent, type KeyboardEvent } from "react";
import { validateMessage, validateFile, MAX_MESSAGE_LENGTH } from "@/lib/chat/constants";
import type { ChatUiVariant } from "@/components/chat/MessageBubble";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (
    content: string,
    attachment?: { url: string; type: string; name: string },
    replyToMessageId?: string | null,
  ) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  variant?: ChatUiVariant;
  replyTo?: { id: string; author: string; content: string } | null;
  onCancelReply?: () => void;
  /** Вставить текст из быстрых ответов оператора. */
  insertText?: string | null;
  onInsertConsumed?: () => void;
}

export function ChatInput({
  onSend,
  disabled,
  placeholder = "Напишите сообщение...",
  variant = "gpt",
  replyTo = null,
  onCancelReply,
  insertText = null,
  onInsertConsumed,
}: ChatInputProps) {
  const isSubs = variant === "subs";
  const accent = isSubs ? "#1DB954" : "#10a37f";
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; type: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    const msgError = !preview ? validateMessage(text) : null;
    if (msgError && !preview) {
      setError(msgError);
      return;
    }

    setSending(true);
    setError(null);
    try {
      await onSend(text, preview ?? undefined, replyTo?.id ?? null);
      setText("");
      setPreview(null);
      textRef.current?.focus();
    } catch {
      setError("Ошибка отправки. Попробуйте ещё раз.");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!insertText) return;
    setText(insertText);
    setError(null);
    onInsertConsumed?.();
    textRef.current?.focus();
  }, [insertText, onInsertConsumed]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      if (replyTo) {
        e.preventDefault();
        onCancelReply?.();
      }
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileError = validateFile(file);
    if (fileError) {
      setError(fileError);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/chat/attachment", { method: "POST", body: fd, credentials: "include" });
      const data = (await res.json()) as { url?: string; type?: string; name?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "upload failed");
      if (!data.url) throw new Error("Нет url");
      setPreview({ url: data.url, type: data.type ?? "application/octet-stream", name: data.name ?? file.name });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки файла");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const isImage = preview?.type.startsWith("image/");

  return (
    <div
      className={cn(
        "space-y-2 border-t p-3",
        isSubs ? "border-white/10 bg-[#111111]" : "border-gray-100 bg-white",
      )}
    >
      {preview && (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ backgroundColor: `${accent}1a` }}
        >
          {isImage ? (
            <img src={preview.url} alt="" className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${accent}33` }}
            >
              <span className="text-xs">📎</span>
            </div>
          )}
          <span className={cn("flex-1 truncate text-sm", isSubs ? "text-gray-200" : "text-gray-700")}>
            {preview.name}
          </span>
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="text-gray-400 transition-colors hover:text-red-500"
          >
            ×
          </button>
        </div>
      )}

      {replyTo && (
        <div
          className="flex items-start gap-2 rounded-xl border px-3 py-2"
          style={{ borderColor: `${accent}4d`, backgroundColor: `${accent}12` }}
        >
          <div className="min-w-0 flex-1">
            <p className={cn("text-xs font-semibold", isSubs ? "text-gray-200" : "text-gray-700")}>
              Ответ: {replyTo.author}
            </p>
            <p className={cn("truncate text-xs", isSubs ? "text-gray-400" : "text-gray-500")}>
              {replyTo.content}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="text-gray-400 transition-colors hover:text-red-500"
            aria-label="Отменить ответ"
          >
            ×
          </button>
        </div>
      )}

      {error && <p className="px-1 text-xs text-red-400">{error}</p>}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading}
          className={cn(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-40",
            isSubs
              ? "bg-white/10 text-gray-300 hover:bg-white/15"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200",
          )}
          title="Прикрепить файл"
        >
          {uploading ? (
            <svg className="h-4 w-4 animate-spin text-gray-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          )}
        </button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleFile} accept="image/*,.pdf,.txt,.doc,.docx" />

        <div className="relative min-w-0 flex-1">
          <textarea
            ref={textRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || sending}
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            className={cn(
              "max-h-32 w-full min-h-[38px] resize-none overflow-y-auto rounded-xl border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50",
              isSubs
                ? "border-white/10 bg-[#161616] text-gray-100 placeholder-gray-500 focus:border-[#1DB954] focus:ring-[#1DB954]/25"
                : "border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 focus:border-[#10a37f] focus:bg-white focus:ring-[#10a37f]/20",
            )}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
            }}
          />
          {text.length > MAX_MESSAGE_LENGTH * 0.8 && (
            <span
              className={cn(
                "absolute bottom-2 right-2 text-xs",
                isSubs ? "text-gray-600" : "text-gray-400",
              )}
            >
              {text.length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={disabled || sending || (!text.trim() && !preview)}
          className={cn(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            isSubs ? "bg-[#1DB954] hover:bg-[#1ed760]" : "bg-[#10a37f] hover:bg-[#0d8f68]",
          )}
        >
          {sending ? (
            <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </div>

      <p
        className={cn(
          "hidden text-center text-xs sm:block",
          isSubs ? "text-gray-600" : "text-gray-400",
        )}
      >
        Enter — отправить · Shift+Enter — новая строка · Esc — отменить ответ
      </p>
    </div>
  );
}
