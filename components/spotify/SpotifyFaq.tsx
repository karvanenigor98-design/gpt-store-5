"use client";

import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SPOTIFY_ACCENT, SPOTIFY_GLOW } from "@/lib/content/spotify";
import { useSpotifyLanding } from "@/components/spotify/SpotifyLandingProvider";

export function SpotifyFaq() {
  const { faq, faqSection: sec } = useSpotifyLanding();
  return (
    <section
      id="faq"
      className="px-4 py-20 md:px-6 md:py-28"
      style={{ background: "#0d0d0d" }}
    >
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mb-14 flex flex-col items-center gap-3 text-center"
        >
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
            style={{ background: SPOTIFY_GLOW, border: "1px solid rgba(29,185,84,0.25)", color: SPOTIFY_ACCENT }}
          >
            {sec.eyebrow}
          </span>
          <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">{sec.title}</h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Accordion type="single" collapsible>
            {faq.map((item, index) => (
              <AccordionItem
                key={`faq-${index}-${item.question.slice(0, 40)}`}
                value={`item-${index}`}
                className="border-b last:border-b-0"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}
              >
                <AccordionTrigger
                  className="px-5 py-4 text-left text-base hover:no-underline"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  {item.question}
                </AccordionTrigger>
                <AccordionContent
                  className="px-5 pb-4 text-sm leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
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
