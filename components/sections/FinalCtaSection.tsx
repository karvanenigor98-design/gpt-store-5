"use client";

import { motion } from "framer-motion";
import { ArrowRight, Clock3, Lock, ShieldCheck } from "lucide-react";
import { CrossSellSection } from "@/components/sections/CrossSellSection";
import { fadeUp } from "@/lib/motion-config";

export function FinalCtaSection() {
  return (
    <section id="final-cta" className="relative overflow-hidden py-16 md:py-28">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 100%, rgba(16,163,127,0.06) 0%, transparent 70%)",
        }}
      />

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={fadeUp}
        className="relative z-10 mx-auto max-w-4xl px-4 text-center"
      >
        <span className="mb-4 inline-block text-xs font-semibold uppercase tracking-widest text-[#10a37f]">
          Готовы начать?
        </span>
        <h2 className="font-heading text-3xl font-bold text-gray-900 md:text-5xl">
          Подключите Plus или Pro за 5–15 минут
        </h2>
        <p className="mt-4 text-base text-gray-500 md:text-lg">
          Доступ к актуальной версии ChatGPT 5.5. Без иностранной карты. Гарантия и поддержка 24/7.
        </p>

        <div className="mt-10">
          <motion.a
            href="#pricing"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold text-white shadow-lg md:px-10 md:py-5 md:text-xl"
            style={{
              background: "#10a37f",
              boxShadow: "0 4px 30px rgba(16,163,127,0.35)",
            }}
          >
            Выбрать подписку
            <ArrowRight size={20} />
          </motion.a>
        </div>

        <CrossSellSection />

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 md:gap-8">
          {[
            { icon: Lock, text: "Без иностранной карты" },
            { icon: Clock3, text: "Активация 5–15 минут" },
            { icon: ShieldCheck, text: "Гарантия на срок" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 text-xs text-gray-500">
              <Icon size={12} />
              {text}
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}


