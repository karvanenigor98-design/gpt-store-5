"use client";

import { motion } from "framer-motion";
import { HOW_IT_WORKS_STEPS } from "@/lib/chatgpt-data";
import { fadeUp, scaleIn, staggerContainer } from "@/lib/motion-config";
import { chatLandingLucideIcon } from "@/components/sections/chatgpt-landing-icons";

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="mb-14 flex flex-col items-center gap-3 text-center"
        >
          <span className="inline-flex items-center rounded-full border border-[#10a37f]/20 bg-[#10a37f]/8 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#10a37f]">
            Процесс подключения
          </span>
          <h2 className="font-heading text-3xl font-bold text-gray-900 md:text-4xl">
            От выбора тарифа до доступа к ChatGPT — несколько понятных шагов
          </h2>
          <p className="max-w-2xl text-lg text-gray-500">
            Оплата в рублях, инструкции в кабинете, статус заказа в реальном времени.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
          className="grid gap-6 md:grid-cols-4"
        >
          {HOW_IT_WORKS_STEPS.map((step, index) => {
            const Icon = chatLandingLucideIcon(step.icon);
            return (
              <motion.article
                key={step.title}
                variants={scaleIn}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="relative rounded-2xl border border-black/[0.07] bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="absolute -left-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#10a37f] text-xs font-bold text-white">
                  {index + 1}
                </span>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#10a37f]/10 border border-[#10a37f]/15">
                  <Icon size={22} color="#10a37f" className="shrink-0" aria-hidden />
                </div>
                <h3 className="font-heading text-base font-semibold text-gray-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-gray-500">{step.description}</p>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}


