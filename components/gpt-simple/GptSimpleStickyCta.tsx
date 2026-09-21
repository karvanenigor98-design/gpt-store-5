"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

import { CHATGPT_PLANS } from "@/lib/chatgpt-data";

const GO_FROM = CHATGPT_PLANS.go.find((plan) => plan.id === "go-1m")?.price ?? 1000;

export function GptSimpleStickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero");
    if (!hero) return;

    const mq = window.matchMedia("(max-width: 767px)");
    let heroVisible = true;

    const recompute = () => {
      setVisible(mq.matches && !heroVisible);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        heroVisible = Boolean(entry?.isIntersecting);
        recompute();
      },
      { threshold: 0.08, rootMargin: "-56px 0px 0px 0px" },
    );

    const onMq = () => recompute();
    mq.addEventListener("change", onMq);
    observer.observe(hero);
    recompute();

    return () => {
      mq.removeEventListener("change", onMq);
      observer.disconnect();
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[45] md:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
    >
      <div
        className="pointer-events-auto mx-auto flex w-full max-w-lg px-3 pt-2"
        style={{
          paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
          paddingRight: "calc(4.75rem + max(0.75rem, env(safe-area-inset-right)))",
        }}
      >
        <button
          type="button"
          onClick={() => document.getElementById("plans")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="flex min-h-[3rem] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-[#10a37f] px-3 py-3 text-sm font-semibold text-white shadow-lg"
          style={{ boxShadow: "0 6px 24px rgba(16,163,127,0.35)" }}
        >
          <span className="truncate">Тарифы от {GO_FROM.toLocaleString("ru")} ₽</span>
          <ArrowRight size={16} className="shrink-0" />
        </button>
      </div>
    </div>
  );
}
