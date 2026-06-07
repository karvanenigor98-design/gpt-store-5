"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ChevronDown, MessageCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type TokenSafetyVariant = "gpt" | "subs";

const FACTS = [
  {
    title: "После оплаты",
    body: "После оплаты специалист напишет вам в чат сайта и уточнит дальнейшие шаги по подключению.",
  },
  {
    title: "Где общение",
    body: "Все рабочие детали по подключению передаются только в официальном чате сайта.",
  },
  {
    title: "Если нужен вход в аккаунт",
    body: "Для некоторых тарифов может потребоваться вход в ваш аккаунт ChatGPT. Оператор заранее объяснит, какие данные нужны и куда их безопасно передать.",
  },
];

interface Props {
  compact?: boolean;
  className?: string;
  /** Показать кнопку «Написать в поддержку» (чат сайта) */
  showSupportLink?: boolean;
  supportHref?: string;
  variant?: TokenSafetyVariant;
}

export function TokenSafetyBlock({
  compact = false,
  className,
  showSupportLink = true,
  supportHref = "/dashboard/chat",
  variant = "gpt",
}: Props) {
  const isSubs = variant === "subs";
  const accent = isSubs ? "#1DB954" : "#10a37f";
  const siteLabel = isSubs ? "SPOTIFY STORE" : "GPT STORE";

  const [isOpen, setIsOpen] = useState(!compact);
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
                Как работает подключение: выберите тариф, оплатите заказ и дождитесь сообщения специалиста
                в чате {siteLabel}. Если для выбранного варианта потребуется вход в аккаунт ChatGPT, оператор
                подскажет шаги перед подключением.
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
                    Откроется чат сайта — там специалист подскажет, что делать дальше.
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
                Мы не просим отправлять данные заранее до оплаты. Все шаги по подключению вы получаете
                в чате {siteLabel} после оплаты заказа.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
