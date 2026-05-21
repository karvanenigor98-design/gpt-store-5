"use client";

import { SPOTIFY_ACCENT, SPOTIFY_GLOW } from "@/lib/content/spotify";
import { motion } from "framer-motion";
import { Users, User, UsersRound } from "lucide-react";

const COMPARE_ITEMS = [
  {
    icon: User,
    title: "Индивидуальная",
    audience: "Обычно подходит для одного пользователя",
    details:
      "Один аккаунт Spotify Premium без рекламы, офлайн-прослушивание и полный доступ к каталогу. Удобно, если подписка нужна только вам.",
    hint: "Часто выбирают на 1–3 месяца для пробы или на 6–12 месяцев для экономии.",
  },
  {
    icon: Users,
    title: "Для двоих",
    audience: "Рассчитан на двух пользователей",
    details:
      "Формат для пары или двух близких аккаунтов. Каждый слушает со своего профиля, условия могут зависеть от региона и формата подключения.",
    hint: "Выгоднее двух отдельных подписок, если Premium нужен вам обоим.",
  },
  {
    icon: UsersRound,
    title: "Family / Семейная",
    audience: "Обычно подходит для семьи или нескольких участников",
    details:
      "Семейный формат для нескольких профилей в одной подписке. Точное число мест может зависеть от региона и типа подключения — подскажем при оформлении.",
    hint: "Лучший выбор, если Premium нужен 3+ людям в доме.",
  },
];

export function SpotifyCompare() {
  return (
    <section
      id="compare"
      className="px-4 py-16 md:px-6 md:py-24"
      style={{ background: "#0a0a0a" }}
    >
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="mb-10 flex flex-col items-center gap-3 text-center"
        >
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
            style={{ background: SPOTIFY_GLOW, border: "1px solid rgba(29,185,84,0.25)", color: SPOTIFY_ACCENT }}
          >
            Сравнение тарифов
          </span>
          <h2 className="font-heading text-2xl font-bold text-white md:text-3xl">
            Какой формат Spotify Premium выбрать
          </h2>
          <p className="max-w-2xl text-base" style={{ color: "rgba(255,255,255,0.5)" }}>
            Коротко о различиях — без лишних обещаний. Точные условия уточним под ваш регион и способ подключения.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COMPARE_ITEMS.map((item, i) => (
            <motion.article
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="flex flex-col rounded-2xl p-5"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: SPOTIFY_GLOW, border: "1px solid rgba(29,185,84,0.2)" }}
              >
                <item.icon size={20} style={{ color: SPOTIFY_ACCENT }} />
              </div>
              <h3 className="mb-1 font-heading text-lg font-bold text-white">{item.title}</h3>
              <p className="mb-3 text-sm font-medium" style={{ color: SPOTIFY_ACCENT }}>
                {item.audience}
              </p>
              <p className="mb-4 flex-1 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                {item.details}
              </p>
              <p
                className="rounded-xl px-3 py-2 text-xs leading-relaxed"
                style={{ background: "rgba(29,185,84,0.08)", color: "rgba(255,255,255,0.45)" }}
              >
                {item.hint}
              </p>
            </motion.article>
          ))}
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
          Условия могут зависеть от региона и формата подключения. На длинный срок обычно выгоднее тариф с большим периодом.
        </p>
      </div>
    </section>
  );
}
