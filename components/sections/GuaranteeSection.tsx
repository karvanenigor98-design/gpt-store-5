"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { GUARANTEE_POINTS } from "@/lib/chatgpt-data";
import { fadeUp } from "@/lib/motion-config";

export function GuaranteeSection() {
  return (
    <section id="guarantee" className="px-4 py-20 md:px-6 md:py-28">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={fadeUp}
        className="mx-auto max-w-4xl"
      >
        <div className="rounded-2xl border border-[#10a37f]/20 bg-[#10a37f]/4 p-6 md:p-10">
          <span className="inline-flex items-center rounded-full border border-[#10a37f]/20 bg-gray-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#10a37f]">
            Гарантия
          </span>
          <ShieldCheck className="mt-4 h-12 w-12 text-[#10a37f]" />
          <h2 className="mt-4 font-heading text-3xl font-bold text-gray-900 md:text-4xl">
            Более 10 000 подключений и рейтинг 4.9/5
          </h2>
          <p className="mt-2 text-base text-gray-600">
            Гарантия на весь срок подписки, поддержка 24/7 и статус заказа в личном кабинете.
          </p>
          <ul className="mt-5 space-y-3 text-gray-600">
            {GUARANTEE_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2">
                <span className="mt-1 text-[#10a37f]">•</span>
                {point}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-gray-400">
            За всё время работы мы восстановили 100% обращений по гарантии.
          </p>
        </div>
      </motion.div>
    </section>
  );
}


