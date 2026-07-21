"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Clock, Circle } from "lucide-react";
import {
  mapOrderStatusToTrackerStep,
  type OrderTrackerStep,
} from "@/lib/dashboard/order-status-tracker";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { cn } from "@/lib/utils";

interface StatusStep {
  key: OrderTrackerStep;
  label: string;
  hint: string;
}

const STEPS: StatusStep[] = [
  {
    key: "payment_received",
    label: "Оплата получена",
    hint: "Платёж подтверждён.",
  },
  {
    key: "awaiting_data",
    label: "Ожидаем данные",
    hint: "Специалист свяжется с вами для получения данных, необходимых для активации.",
  },
  {
    key: "activation",
    label: "Активация подписки",
    hint: "Подключаем подписку к вашему аккаунту.",
  },
  {
    key: "activated",
    label: "Активировано",
    hint: "Подписка успешно подключена.",
  },
];

function stepIndex(step: OrderTrackerStep): number {
  const idx = STEPS.findIndex((s) => s.key === step);
  return idx === -1 ? 0 : idx;
}

const ACTIVATION_MINUTES: Record<string, number> = {
  "plus-fast": 5,
  "plus-std": 15,
  "plus-ready": 15,
  "plus-new": 15,
  "pro-5x": 10,
  "pro-20x": 10,
};

interface Props {
  orderId: string;
  initialStatus: string;
  siteSlug: SiteSlug;
  planId?: string;
  activatedAt?: string | null;
  variant?: "light" | "subs";
}

export function OrderStatusTracker({
  orderId,
  initialStatus,
  siteSlug,
  planId,
  activatedAt,
  variant = "light",
}: Props) {
  const [trackerStep, setTrackerStep] = useState<OrderTrackerStep>(() =>
    mapOrderStatusToTrackerStep(initialStatus),
  );
  const [countdown, setCountdown] = useState<string | null>(null);
  const isSubs = variant === "subs";
  const accent = isSubs ? "#1DB954" : "#10a37f";

  useEffect(() => {
    setTrackerStep(mapOrderStatusToTrackerStep(initialStatus));
  }, [initialStatus]);

  useEffect(() => {
    if (trackerStep !== "activation") {
      setCountdown(null);
      return;
    }

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
  }, [trackerStep, planId, activatedAt]);

  const currentIdx = stepIndex(trackerStep);

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

      <div className="hidden items-start gap-0 md:flex">
        {STEPS.map((step, i) => {
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;

          return (
            <div key={step.key} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    i === 0 ? "invisible" : isDone || isCurrent ? "" : isSubs ? "bg-white/15" : "bg-gray-200",
                  )}
                  style={
                    i !== 0 && (isDone || isCurrent) ? { backgroundColor: accent } : undefined
                  }
                />
                <motion.div
                  animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                  transition={isCurrent ? { duration: 1.2, repeat: Infinity } : {}}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                    isDone && "text-white",
                    !isDone &&
                      !isCurrent &&
                      (isSubs
                        ? "border-white/20 bg-[#161616] text-gray-500"
                        : "border-gray-200 bg-white text-gray-300"),
                    isCurrent &&
                      !isDone &&
                      (isSubs
                        ? "bg-[#161616] text-[#1DB954]"
                        : "border-[#10a37f] bg-white text-[#10a37f]"),
                  )}
                  style={
                    isDone
                      ? { borderColor: accent, backgroundColor: accent }
                      : isCurrent
                        ? { borderColor: accent }
                        : undefined
                  }
                >
                  {isDone ? (
                    <Check size={14} />
                  ) : isCurrent ? (
                    <Circle size={14} style={{ fill: accent }} />
                  ) : (
                    <Circle size={14} />
                  )}
                </motion.div>
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
                  !isDone &&
                    !isCurrent &&
                    (isSubs
                      ? "border-white/20 bg-[#161616] text-gray-500"
                      : "border-gray-200 bg-white text-gray-300"),
                  isCurrent &&
                    !isDone &&
                    (isSubs ? "bg-[#161616]" : "border-[#10a37f] bg-white text-[#10a37f]"),
                )}
                style={
                  isDone
                    ? { borderColor: accent, backgroundColor: accent }
                    : isCurrent
                      ? { borderColor: accent, color: accent }
                      : undefined
                }
              >
                {isDone ? (
                  <Check size={12} />
                ) : (
                  <Circle size={10} style={isCurrent ? { fill: accent } : undefined} />
                )}
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
                  <p className={cn("mt-0.5 text-xs", isSubs ? "text-gray-500" : "text-gray-500")}>
                    {step.hint}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
    </div>
  );
}
