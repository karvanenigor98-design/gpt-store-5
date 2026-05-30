"use client";

import { useEffect } from "react";

type Accent = "gpt" | "subs";

const RING: Record<Accent, string> = {
  gpt: "ring-2 ring-[#10a37f] ring-offset-2 bg-[#10a37f]/10",
  subs: "ring-2 ring-[#1DB954] ring-offset-2 bg-[#1DB954]/12",
};

export function HighlightScroll({ accent = "gpt", param = "highlight" }: { accent?: Accent; param?: string }) {
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const id = qs.get(param) ?? qs.get("highlightOrder") ?? qs.get("order_id") ?? qs.get("highlight");
    if (!id) return;

    const timer = window.setTimeout(() => {
      const el = document.getElementById(`row-${id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const ringClass = RING[accent];
      for (const cls of ringClass.split(" ")) el.classList.add(cls);
      window.setTimeout(() => {
        for (const cls of ringClass.split(" ")) el.classList.remove(cls);
      }, 4500);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [accent, param]);

  return null;
}
