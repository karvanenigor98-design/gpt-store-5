"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ChevronDown, CheckCircle2, ExternalLink, MessageCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CHATGPT_SESSION_URL, SESSION_INSTRUCTION_STEPS } from "@/lib/copy/session-instruction";

export type TokenSafetyVariant = "gpt" | "subs";

const FACTS = [
  {
    title: "Зачем нужны данные сессии",
    body: "Иногда для подключения подписки ChatGPT на ваш аккаунт нужны данные сессии из браузера. Без них технически нельзя завершить привязку подписки.",
  },
  {
    title: "Куда отправлять",
    body: "Такие данные могут фактически открывать доступ к сессии аккаунта, поэтому передавайте их только в официальный чат сайта — не в мессенджеры и не на сторонние адреса.",
  },
  {
    title: "После подключения",
    body: "Когда подписка подключена, вы можете завершить активные сессии или обновить настройки безопасности в ChatGPT. В большинстве случаев пароль не требуется. Если нужны дополнительные данные — специалист заранее уточнит.",
  },
];

interface Props {
  compact?: boolean;
  onSendToken?: () => void;
  className?: string;
  /** Показать кнопку «Написать в поддержку» (чат сайта) */
  showSupportLink?: boolean;
  supportHref?: string;
  variant?: TokenSafetyVariant;
}

export function TokenSafetyBlock({
  compact = false,
  onSendToken,
  className,
  showSupportLink = true,
  supportHref = "/dashboard/chat",
  variant = "gpt",
}: Props) {
  const isSubs = variant === "subs";
  const accent = isSubs ? "#1DB954" : "#10a37f";
  const siteLabel = isSubs ? "SPOTIFY STORE" : "GPT STORE";

  const [isOpen, setIsOpen] = useState(!compact);
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(CHATGPT_SESSION_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-2xl border",
        isSubs ? "border-white/10 bg-[#161616]" : "border-black/[0.08] bg-white",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4"
      >
        <div className="flex items-center gap-2.5">
          <Lock size={16} className="shrink-0" style={{ color: accent }} />
          <span
            className={cn(
              "text-sm font-semibold",
              isSubs ? "text-white" : "text-gray-800",
            )}
          >
            Как работает подключение
          </span>
        </div>
        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 transition-transform",
            isSubs ? "text-gray-500" : "text-gray-400",
            isOpen && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "space-y-5 border-t px-5 pb-5 pt-4",
                isSubs ? "border-white/10" : "border-black/[0.06]",
              )}
            >
              <p
                className={cn(
                  "text-sm leading-relaxed",
                  isSubs ? "text-gray-300" : "text-gray-700",
                )}
              >
                Для части сценариев подключения нужны{" "}
                <span className={cn("font-semibold", isSubs ? "text-white" : "text-gray-800")}>
                  данные сессии
                </span>{" "}
                аккаунта ChatGPT. Это{" "}
                <span className="font-semibold">не пароль</span>, но такие данные могут давать доступ к
                сессии аккаунта — относитесь к ним внимательно и отправляйте только в чат {siteLabel}.
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                {FACTS.map((fact) => (
                  <div
                    key={fact.title}
                    className={cn(
                      "rounded-xl border p-3",
                      isSubs
                        ? "border-white/10 bg-[#1a1a1a]"
                        : "border-black/[0.06] bg-gray-50",
                    )}
                  >
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <Lock size={13} style={{ color: accent }} />
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          isSubs ? "text-white" : "text-gray-800",
                        )}
                      >
                        {fact.title}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-xs leading-relaxed",
                        isSubs ? "text-gray-400" : "text-gray-700",
                      )}
                    >
                      {fact.body}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <p
                  className={cn(
                    "mb-3 text-sm font-semibold",
                    isSubs ? "text-white" : "text-gray-800",
                  )}
                >
                  Следуйте, пожалуйста, инструкции:
                </p>
                <ol className="space-y-3">
                  {SESSION_INSTRUCTION_STEPS.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{
                          backgroundColor: `${accent}1a`,
                          color: accent,
                        }}
                      >
                        {i + 1}
                      </span>
                      <div
                        className={cn(
                          "min-w-0 flex-1 text-sm",
                          isSubs ? "text-gray-300" : "text-gray-700",
                        )}
                      >
                        <p>{step}</p>
                        {i === 2 && (
                          <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:items-center">
                            <button
                              type="button"
                              onClick={() => void copyUrl()}
                              className="inline-flex w-full max-w-full items-center justify-center break-all rounded-lg border px-3 py-2 text-left font-mono text-[12px] font-medium sm:w-auto"
                              style={{
                                borderColor: `${accent}59`,
                                backgroundColor: `${accent}14`,
                                color: accent,
                              }}
                              title="Скопировать ссылку"
                            >
                              {CHATGPT_SESSION_URL}
                            </button>
                            {copied ? (
                              <span className="text-xs font-medium" style={{ color: accent }}>
                                Скопировано
                              </span>
                            ) : (
                              <span className={cn("text-xs", isSubs ? "text-gray-500" : "text-gray-600")}>
                                Нажмите, чтобы скопировать
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>

                {process.env.NEXT_PUBLIC_TOKEN_INSTRUCTION_VIDEO_URL && (
                  <a
                    href={process.env.NEXT_PUBLIC_TOKEN_INSTRUCTION_VIDEO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm hover:underline"
                    style={{ color: accent }}
                  >
                    <ExternalLink size={13} />
                    Посмотреть видео-инструкцию
                  </a>
                )}
              </div>

              {showSupportLink && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Link
                    href={supportHref}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors"
                    style={{
                      borderColor: `${accent}66`,
                      backgroundColor: `${accent}14`,
                      color: accent,
                    }}
                  >
                    <MessageCircle size={16} />
                    Написать в поддержку
                  </Link>
                  <span className={cn("text-xs sm:pl-2", isSubs ? "text-gray-400" : "text-gray-700")}>
                    Откроется чат сайта — туда же отправляйте данные по инструкции.
                  </span>
                </div>
              )}

              <p
                className={cn(
                  "rounded-xl border px-4 py-3 text-xs leading-relaxed",
                  isSubs
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                    : "border-amber-200/60 bg-amber-50 text-amber-800",
                )}
              >
                В большинстве случаев пароль не требуется. Если нужны дополнительные данные или код
                подтверждения — специалист заранее объяснит, что именно нужно. Инструкцию и ответы по
                подключению вы получаете на сайте и в чате {siteLabel}.
              </p>

              {onSendToken && (
                <button
                  type="button"
                  onClick={onSendToken}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: accent }}
                >
                  <CheckCircle2 size={15} />
                  Открыть чат и отправить данные
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
