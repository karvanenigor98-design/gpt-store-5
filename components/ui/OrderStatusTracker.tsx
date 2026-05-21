"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Clock, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { OrderStatus } from "@/types/database";
import { cn } from "@/lib/utils";

interface StatusStep {
  key: OrderStatus;
  label: string;
  hint: string;
}

const STEPS: StatusStep[] = [
  { key: "pending", label: "Ожидает оплаты", hint: "Ожидаем подтверждение оплаты" },
  { key: "activating", label: "В работе", hint: "Наш специалист подключает вашу подписку" },
  { key: "waiting_client", label: "Ожидание токена", hint: "Напишите нам ваш токен в чат" },
  { key: "active", label: "Активировано", hint: "Подписка успешно активирована! Можете пользоваться" },
];

function stepIndex(status: OrderStatus): number {
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}

// Время активации в минутах для тарифов
const ACTIVATION_MINUTES: Record<string, number> = {
  "plus-fast": 5,
  "plus-std": 15,
  "plus-new": 15,
  "pro-5x": 10,
  "pro-20x": 10,
};

interface Props {
  orderId: string;
  initialStatus: OrderStatus;
  planId?: string;
  activatedAt?: string | null;
  onOpenChat?: () => void;
  chatHref?: string;
  variant?: "light" | "subs";
}

export function OrderStatusTracker({
  orderId,
  initialStatus,
  planId,
  activatedAt,
  onOpenChat,
  chatHref,
  variant = "light",
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [countdown, setCountdown] = useState<string | null>(null);
  const isSubs = variant === "subs";
  const accent = isSubs ? "#1DB954" : "#10a37f";

  const openChat =
    onOpenChat ?? (() => router.push(chatHref ?? "/dashboard/chat"));

  // Supabase Realtime — обновление статуса без перезагрузки
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          const newStatus = (payload.new as { status: OrderStatus }).status;
          setStatus(newStatus);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  // Таймер обратного отсчёта при статусе activating
  useEffect(() => {
    if (status !== "activating") { setCountdown(null); return; }

    const totalMinutes = planId ? (ACTIVATION_MINUTES[planId] ?? 15) : 15;
    const startTime = activatedAt ? new Date(activatedAt).getTime() : Date.now();

    const tick = () => {
      const elapsed = (Date.now() - startTime) / 1000 / 60;
      const remaining = totalMinutes - elapsed;
      if (remaining <= 0) {
        setCountdown("Активируем, почти готово...");
      } else {
        const mins = Math.floor(remaining);
        const secs = Math.floor((remaining - mins) * 60);
        setCountdown(`Осталось ~${mins}:${secs.toString().padStart(2, "0")} до активации`);
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [status, planId, activatedAt]);

  const currentIdx = stepIndex(status);

  return (
    <div
      className={cn(
        "rounded-2xl border p-6 shadow-sm",
        isSubs ? "border-white/10 bg-[#111111]" : "border-black/[0.08] bg-white",
      )}
    >
      <h3
        className={cn(
          "mb-6 text-sm font-semibold uppercase tracking-wide",
          isSubs ? "text-gray-400" : "text-gray-500",
        )}
      >
        Статус заказа
      </h3>

      {/* Desktop — горизонтальный прогресс */}
      <div className="hidden items-start gap-0 md:flex">
        {STEPS.map((step, i) => {
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;

          return (
            <div key={step.key} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {/* Connector line left */}
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    i === 0 ? "invisible" : isDone || isCurrent ? "" : isSubs ? "bg-white/15" : "bg-gray-200"
                  )}
                  style={
                    i !== 0 && (isDone || isCurrent) ? { backgroundColor: accent } : undefined
                  }
                />
                {/* Icon */}
                <motion.div
                  animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                  transition={isCurrent ? { duration: 1.2, repeat: Infinity } : {}}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                    isDone && "text-white",
                    !isDone && !isCurrent && (isSubs ? "border-white/20 bg-[#161616] text-gray-500" : "border-gray-200 bg-white text-gray-300"),
                    isCurrent && !isDone && (isSubs ? "bg-[#161616] text-[#1DB954]" : "border-[#10a37f] bg-white text-[#10a37f]"),
                  )}
                  style={
                    isDone
                      ? { borderColor: accent, backgroundColor: accent }
                      : isCurrent
                        ? { borderColor: accent }
                        : undefined
                  }
                >
                  {isDone ? <Check size={14} /> : isCurrent ? <Circle size={14} style={{ fill: accent }} /> : <Circle size={14} />}
                </motion.div>
                {/* Connector line right */}
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    i === STEPS.length - 1 ? "invisible" : isDone ? "" : isSubs ? "bg-white/15" : "bg-gray-200",
                  )}
                  style={i !== STEPS.length - 1 && isDone ? { backgroundColor: accent } : undefined}
                />
              </div>
              <div className="mt-2 px-1 text-center">
                <p
                  className={cn(
                    "text-xs font-semibold",
                    isCurrent && (isSubs ? "text-[#1DB954]" : "text-[#10a37f]"),
                    isDone && (isSubs ? "text-gray-200" : "text-gray-700"),
                    !isCurrent && !isDone && "text-gray-400",
                  )}
                >
                  {step.label}
                </p>
                {isCurrent && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("mt-0.5 text-[11px]", isSubs ? "text-gray-500" : "text-gray-500")}
                  >
                    {step.hint}
                  </motion.p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile — вертикальный timeline */}
      <div className="flex flex-col gap-4 md:hidden">
        {STEPS.map((step, i) => {
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <div key={step.key} className="flex items-start gap-3">
              <motion.div
                animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                transition={isCurrent ? { duration: 1.2, repeat: Infinity } : {}}
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                  isDone && "text-white",
                  !isDone && !isCurrent && (isSubs ? "border-white/20 bg-[#161616] text-gray-500" : "border-gray-200 bg-white text-gray-300"),
                  isCurrent && !isDone && (isSubs ? "bg-[#161616]" : "border-[#10a37f] bg-white text-[#10a37f]"),
                )}
                style={
                  isDone
                    ? { borderColor: accent, backgroundColor: accent }
                    : isCurrent
                      ? { borderColor: accent, color: accent }
                      : undefined
                }
              >
                {isDone ? <Check size={12} /> : <Circle size={10} style={isCurrent ? { fill: accent } : undefined} />}
              </motion.div>
              <div>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isCurrent && (isSubs ? "text-[#1DB954]" : "text-[#10a37f]"),
                    isDone && (isSubs ? "text-gray-200" : "text-gray-700"),
                    !isCurrent && !isDone && "text-gray-400",
                  )}
                >
                  {step.label}
                </p>
                {isCurrent && (
                  <p className={cn("mt-0.5 text-xs", isSubs ? "text-gray-500" : "text-gray-500")}>{step.hint}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Таймер обратного отсчёта */}
      {countdown && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 flex items-center gap-2 rounded-xl px-4 py-2.5"
          style={{ backgroundColor: `${accent}14` }}
        >
          <Clock size={14} className="shrink-0" style={{ color: accent }} />
          <span className="text-sm font-medium" style={{ color: accent }}>
            {countdown}
          </span>
        </motion.div>
      )}

      {status !== "active" && !isSubs && (
        <button
          type="button"
          onClick={openChat}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-black/[0.08] py-2.5 text-sm text-gray-600 transition-colors hover:border-[#10a37f]/40 hover:text-[#10a37f]"
        >
          Написать в поддержку
        </button>
      )}
      {status !== "active" && isSubs && (
        <p className="mt-4 text-center text-xs text-gray-500">
          Чат с оператором открыт справа — напишите туда
        </p>
      )}
    </div>
  );
}
