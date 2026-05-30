"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { RUSSIA_DISCLAIMER, RUSSIA_POINTS } from "@/lib/chatgpt-data";
import { fadeUp, staggerContainer } from "@/lib/motion-config";

export function RussiaSection() {
  return (
    <section id="russia" className="px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="rounded-2xl border border-black/[0.08] bg-white/60 p-6 backdrop-blur-sm md:p-8"
        >
          <span className="inline-flex items-center rounded-full border border-[#10a37f]/20 bg-[#10a37f]/8 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#10a37f]">
            География
          </span>
          <h2 className="mt-4 font-heading text-2xl font-bold text-gray-900 md:text-3xl">
            Работает в России без ограничений
          </h2>
          <p className="mt-3 text-gray-500">
            Активация не зависит от местоположения — подписка подключается на аккаунт напрямую.
          </p>
          <motion.ul
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="mt-6 space-y-3"
          >
            {RUSSIA_POINTS.map((point) => (
              <motion.li key={point} variants={fadeUp} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#10a37f]" />
                <span className="text-gray-600">{point}</span>
              </motion.li>
            ))}
          </motion.ul>
          <p className="mt-6 text-xs leading-relaxed text-gray-400">{RUSSIA_DISCLAIMER}</p>
        </motion.div>
      </div>
    </section>
  );
}


