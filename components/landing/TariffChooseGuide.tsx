"use client";

import { motion } from "framer-motion";
import { ArrowRight, HelpCircle } from "lucide-react";
import { SPOTIFY_ACCENT } from "@/lib/content/spotify";

export type TariffGuideItem = {
  label: string;
  hint: string;
  href?: string;
};

type TariffChooseGuideProps = {
  theme: "gpt" | "spotify";
  title?: string;
  subtitle?: string;
  items: TariffGuideItem[];
  supportHref?: string;
};

const GPT_ACCENT = "#10a37f";

export function TariffChooseGuide({
  theme,
  title = "Не знаете, что выбрать — подскажем самый подходящий вариант",
  subtitle,
  items,
  supportHref,
}: TariffChooseGuideProps) {
  const isSpotify = theme === "spotify";
  const accent = isSpotify ? SPOTIFY_ACCENT : GPT_ACCENT;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35 }}
      className="mx-auto mb-10 w-full max-w-5xl"
    >
      <div
        className="rounded-2xl border p-5 md:p-6"
        style={
          isSpotify
            ? {
                background: "rgba(255,255,255,0.03)",
                borderColor: "rgba(255,255,255,0.08)",
              }
            : {
                background: "linear-gradient(135deg, rgba(16,163,127,0.06) 0%, rgba(255,255,255,0.95) 100%)",
                borderColor: "rgba(16,163,127,0.18)",
              }
        }
      >
        <div className="mb-4 flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: isSpotify ? "rgba(29,185,84,0.12)" : "rgba(16,163,127,0.12)",
              border: `1px solid ${isSpotify ? "rgba(29,185,84,0.25)" : "rgba(16,163,127,0.2)"}`,
            }}
          >
            <HelpCircle size={18} style={{ color: accent }} />
          </div>
          <div className="text-left">
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: isSpotify ? "rgba(255,255,255,0.4)" : "#6b7280" }}
            >
              Как выбрать тариф
            </p>
            <h3
              className="mt-1 font-heading text-lg font-bold leading-snug md:text-xl"
              style={{ color: isSpotify ? "#fff" : "#111827" }}
            >
              {title}
            </h3>
            {subtitle ? (
              <p
                className="mt-1.5 text-sm leading-relaxed"
                style={{ color: isSpotify ? "rgba(255,255,255,0.5)" : "#6b7280" }}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.label}>
              {item.href ? (
                <a
                  href={item.href}
                  className="group flex h-full flex-col rounded-xl border px-4 py-3 transition-colors"
                  style={
                    isSpotify
                      ? {
                          borderColor: "rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.02)",
                        }
                      : {
                          borderColor: "rgba(0,0,0,0.06)",
                          background: "rgba(255,255,255,0.7)",
                        }
                  }
                >
                  <span
                    className="text-sm font-semibold"
                    style={{ color: isSpotify ? "#fff" : "#111827" }}
                  >
                    {item.label}
                  </span>
                  <span
                    className="mt-0.5 text-xs leading-relaxed"
                    style={{ color: isSpotify ? "rgba(255,255,255,0.45)" : "#6b7280" }}
                  >
                    {item.hint}
                  </span>
                </a>
              ) : (
                <div
                  className="flex h-full flex-col rounded-xl border px-4 py-3"
                  style={
                    isSpotify
                      ? {
                          borderColor: "rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.02)",
                        }
                      : {
                          borderColor: "rgba(0,0,0,0.06)",
                          background: "rgba(255,255,255,0.7)",
                        }
                  }
                >
                  <span
                    className="text-sm font-semibold"
                    style={{ color: isSpotify ? "#fff" : "#111827" }}
                  >
                    {item.label}
                  </span>
                  <span
                    className="mt-0.5 text-xs leading-relaxed"
                    style={{ color: isSpotify ? "rgba(255,255,255,0.45)" : "#6b7280" }}
                  >
                    {item.hint}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>

        {supportHref ? (
          <a
            href={supportHref}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ color: accent }}
          >
            Не уверены — напишите в поддержку, подскажем
            <ArrowRight size={14} />
          </a>
        ) : null}
      </div>
    </motion.div>
  );
}

export const GPT_TARIFF_GUIDE_ITEMS: TariffGuideItem[] = [
  {
    label: "Нужен готовый аккаунт",
    hint: "«Готовый аккаунт ChatGPT Plus» — аккаунт с уже активированной подпиской и данными для входа.",
    href: "#pricing",
  },
  {
    label: "Нужен обычный ChatGPT Plus на ваш аккаунт",
    hint: "Выбирайте «Популярный» — лучший баланс цены и скорости подключения.",
    href: "#pricing",
  },
  {
    label: "Нужны максимальные возможности",
    hint: "Смотрите Pro 5x или Pro 20x — больше лимитов для интенсивной работы.",
    href: "#pricing",
  },
  {
    label: "Нужно подключиться быстрее",
    hint: "«Быстрая активация» — приоритет вне очереди, обычно 5–15 минут.",
    href: "#pricing",
  },
  {
    label: "Как проходит подключение",
    hint: "После оплаты оператор пишет в чат сайта и ведёт вас по шагам. Если нужен вход в аккаунт, это объяснят отдельно.",
    href: "#pricing",
  },
];

export const SPOTIFY_TARIFF_GUIDE_ITEMS: TariffGuideItem[] = [
  {
    label: "Берёте впервые",
    hint: "Начните с 1 месяца — попробуйте Premium без долгой привязки.",
  },
  {
    label: "Хотите выгоднее",
    hint: "3 месяца — оптимальный выбор: дешевле, чем платить каждый месяц.",
  },
  {
    label: "Для пары",
    hint: "Premium для двоих — у каждого свой профиль, выгоднее двух подписок.",
  },
  {
    label: "Для семьи",
    hint: "Family — до 5 участников в одном тарифе.",
  },
  {
    label: "Нужен отдельный старт",
    hint: "Новый аккаунт — если не принципиален текущий Spotify-профиль.",
  },
];
