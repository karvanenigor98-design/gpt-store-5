"use client";

import { motion } from "framer-motion";
import { TokenSafetyBlock } from "@/components/ui/TokenSafetyBlock";
import { fadeUp, staggerContainer } from "@/lib/motion-config";

export function TokenSafetySection() {
  return (
    <section id="connection" className="px-4 py-16 md:px-6 md:py-20">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={staggerContainer}
        className="mx-auto max-w-3xl"
      >
        <motion.div variants={fadeUp} className="mb-6 text-center">
          <span className="mb-3 inline-block rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            Безопасность
          </span>
          <h2 className="font-heading text-2xl font-bold text-gray-900 md:text-3xl">
            Данные сессии — честно и понятно
          </h2>
          <p className="mt-3 text-gray-700">
            Рассказываем, зачем могут понадобиться данные сессии, как их получить по ссылке chatgpt.com и как
            передавать их безопасно — только в чат сайта GPT STORE.
          </p>
        </motion.div>

        <motion.div variants={fadeUp}>
          <TokenSafetyBlock compact={false} />
        </motion.div>
      </motion.div>
    </section>
  );
}


