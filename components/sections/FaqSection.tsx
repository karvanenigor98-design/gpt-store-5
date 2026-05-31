"use client";

import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_ITEMS } from "@/lib/chatgpt-data";
import { fadeUp } from "@/lib/motion-config";

export function FaqSection() {
  return (
    <section id="faq" className="px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="mb-14 flex flex-col items-center gap-3 text-center"
        >
          <span className="inline-flex items-center rounded-full border border-[#10a37f]/20 bg-[#10a37f]/8 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#10a37f]">
            Частые вопросы
          </span>
          <h2 className="font-heading text-3xl font-bold text-gray-900 md:text-4xl">
            Ответы на вопросы, которые обычно возникают перед оплатой
          </h2>
          <p className="max-w-2xl text-sm text-gray-500 md:text-base">
            Про карту, пароль, гарантию и разницу тарифов — коротко и по делу.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="rounded-2xl border border-black/[0.08] bg-gray-50"
        >
          <Accordion type="single" collapsible>
            {FAQ_ITEMS.map((item, index) => (
              <AccordionItem
                key={item.question}
                value={`item-${index}`}
                className="border-b border-black/[0.06] last:border-b-0"
              >
                <AccordionTrigger className="px-5 py-4 text-left text-base text-gray-900 hover:text-gray-700 hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-4 text-sm leading-relaxed text-gray-500">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}


