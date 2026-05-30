"use client";

import { motion } from "framer-motion";

const TICKER_ITEMS = [
  "⚡ Активация за 5–15 минут",
  "✓ 1 200+ подключений",
  "★ Рейтинг 4.9 / 5",
  "🛡 Гарантия на весь срок",
  "24/7 Поддержка",
  "💳 Без иностранной карты",
  "🇷🇺 Работает в России",
];

export function Ticker() {
  const repeated = [...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <div className="relative overflow-hidden border-y border-black/[0.06] bg-white/50 py-3.5 backdrop-blur-sm">
      <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-24"
        style={{ background: "linear-gradient(to right, #f9fafb, transparent)" }} />
      <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-24"
        style={{ background: "linear-gradient(to left, #f9fafb, transparent)" }} />
      <motion.div
        className="flex gap-12 whitespace-nowrap"
        animate={{ x: ["0%", "-33.33%"] }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      >
        {repeated.map((item, i) => (
          <span key={i} className="inline-flex shrink-0 items-center gap-3 text-sm font-medium text-gray-500">
            {item}
            <span className="h-1 w-1 shrink-0 rounded-full bg-gray-300" />
          </span>
        ))}
      </motion.div>
    </div>
  );
}


