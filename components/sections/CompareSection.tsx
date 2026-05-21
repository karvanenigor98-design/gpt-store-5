"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X, ChevronDown } from "lucide-react";
import { fadeUp, staggerContainer } from "@/lib/motion-config";

type CellValue = boolean | string;

interface CompareRow {
  feature: string;
  plus: CellValue;
  pro: CellValue;
}

const ROWS: CompareRow[] = [
  { feature: "ChatGPT 5.5 доступ", plus: true, pro: true },
  { feature: "Скорость и глубина ответов ChatGPT 5.5", plus: "Стандарт", pro: "Максимум" },
  { feature: "Режим без лимитов ChatGPT 5.5", plus: false, pro: true },
  { feature: "Генерация изображений", plus: "До 40/день", pro: "Безлимитно" },
  { feature: "Анализ файлов", plus: true, pro: true },
  { feature: "Голосовой режим", plus: "Базовый", pro: "Расширенный" },
  { feature: "Контекст окна", plus: "128k токенов", pro: "200k токенов" },
  { feature: "Приоритет в очереди", plus: false, pro: true },
];

function Cell({ value, accentColor }: { value: CellValue; accentColor: string }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-[#10a37f]" />;
  if (value === false) return <X className="mx-auto h-4 w-4 text-gray-300" />;
  return (
    <span className="text-xs font-medium" style={{ color: accentColor }}>
      {value}
    </span>
  );
}

function MobileCompareCard({ row }: { row: CompareRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-black/[0.08] bg-white p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-medium text-gray-800">{row.feature}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-black/[0.06] pt-3">
          <div className="rounded-lg bg-[#10a37f]/5 p-3 text-center">
            <p className="mb-2 text-xs font-semibold text-[#10a37f]">Plus</p>
            <Cell value={row.plus} accentColor="#10a37f" />
          </div>
          <div className="rounded-lg bg-[#1a56db]/5 p-3 text-center">
            <p className="mb-2 text-xs font-semibold text-[#1a56db]">Pro</p>
            <Cell value={row.pro} accentColor="#1a56db" />
          </div>
        </div>
      )}
    </div>
  );
}

export function CompareSection() {
  return (
    <section id="compare" className="px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="mb-12 flex flex-col items-center gap-3 text-center"
        >
          <span className="inline-flex items-center rounded-full border border-[#10a37f]/20 bg-[#10a37f]/8 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#10a37f]">
            Сравнение
          </span>
          <h2 className="font-heading text-3xl font-bold text-gray-900 md:text-4xl">
            ChatGPT Plus vs ChatGPT Pro
          </h2>
          <p className="max-w-2xl text-lg text-gray-500">
            Детальное сравнение возможностей двух подписок
          </p>
        </motion.div>

        <div className="flex flex-col gap-3 md:hidden">
          {ROWS.map((row) => (
            <MobileCompareCard key={row.feature} row={row} />
          ))}
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="hidden overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-sm md:block"
        >
          <div className="grid grid-cols-3 border-b border-black/[0.06]">
            <div className="p-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
              Возможность
            </div>
            <div className="border-l border-black/[0.06] p-4 text-center text-sm font-bold text-[#10a37f]">
              ChatGPT Plus
            </div>
            <div className="border-l border-black/[0.06] p-4 text-center text-sm font-bold text-[#1a56db]">
              ChatGPT Pro
            </div>
          </div>

          <motion.div variants={staggerContainer}>
            {ROWS.map((row, i) => (
              <motion.div
                key={row.feature}
                variants={fadeUp}
                className="grid grid-cols-3 border-b border-black/[0.05] last:border-b-0"
                style={{ background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)" }}
              >
                <div className="p-4 text-sm text-gray-700">{row.feature}</div>
                <div className="flex items-center justify-center border-l border-black/[0.05] p-4">
                  <Cell value={row.plus} accentColor="#10a37f" />
                </div>
                <div className="flex items-center justify-center border-l border-black/[0.05] p-4">
                  <Cell value={row.pro} accentColor="#1a56db" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
