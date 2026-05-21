"use client";

import { motion } from "framer-motion";
import { Check, Shield, X } from "lucide-react";
import { SAFETY_MYTHS, SAFETY_PRINCIPLES } from "@/lib/chatgpt-data";
import { fadeUp, slideInLeft, staggerContainer } from "@/lib/motion-config";
import { chatLandingLucideIcon } from "@/components/sections/chatgpt-landing-icons";

export function SafetySection() {
  return (
    <section id="safety" className="px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="mb-14 flex flex-col items-center gap-3 text-center"
        >
          <span className="inline-flex items-center rounded-full border border-[#10a37f]/20 bg-[#10a37f]/8 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#10a37f]">
            Безопасность
          </span>
          <div className="flex items-center justify-center rounded-2xl bg-[#10a37f]/10 p-3">
            <Shield className="h-8 w-8 text-[#10a37f]" />
          </div>
          <h2 className="font-heading text-3xl font-bold text-gray-900 md:text-4xl">
            Честно про подключение и данные
          </h2>
          <p className="max-w-2xl text-lg text-gray-700">
            В большинстве случаев пароль не нужен — хватает кода, email или данных сессии по инструкции. Если для
            вашего аккаунта (например, вход через Google) потребуется пароль или OTP, специалист объяснит это до
            передачи данных. Всё только в чат GPT STORE; оплата — через Pally, СБП или карту РФ.
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={slideInLeft}
          >
            <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-gray-600">
              Мифы и реальность
            </p>
            <motion.ul
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="space-y-3"
            >
              {SAFETY_MYTHS.map((item) => (
                <motion.li key={item.myth} variants={fadeUp}>
                  <motion.div
                    className="cursor-default overflow-hidden rounded-xl border border-black/[0.07] bg-white p-5 shadow-sm"
                    whileHover={{ borderColor: "rgba(16,163,127,0.3)" }}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <X size={14} className="shrink-0 text-red-400" />
                      <span className="text-sm text-gray-600 line-through">{item.myth}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check size={14} className="shrink-0 text-[#10a37f]" />
                      <span className="text-sm font-medium text-[#10a37f]">{item.fact}</span>
                    </div>
                  </motion.div>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            className="flex flex-col justify-center"
          >
            <div className="rounded-2xl border border-[#10a37f]/15 bg-white p-6 shadow-sm">
              <h3 className="mb-5 font-heading text-lg font-semibold text-gray-900">
                Принцип работы
              </h3>
              <ul className="space-y-4">
                {SAFETY_PRINCIPLES.map((principle) => {
                  const Icon = chatLandingLucideIcon(principle.icon);
                  return (
                    <li key={principle.text} className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#10a37f]/10">
                        <Icon className="h-4 w-4 shrink-0 text-[#10a37f]" aria-hidden />
                      </span>
                      <span className="text-sm text-gray-600">{principle.text}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-6 rounded-xl bg-[#10a37f]/8 px-4 py-3 text-sm font-medium leading-relaxed text-[#10a37f]">
                Пароль не просим «на всякий случай». Если он действительно нужен для подключения — согласуем шаги в
                чате и принимаем только на сайте GPT STORE.
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}


