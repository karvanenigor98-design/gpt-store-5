"use client";

import { ArrowRight } from "lucide-react";

import { GptHeroResultCard } from "@/components/sections/GptHeroResultCard";

const HERO_FEATURES = [
  "Оплата картой РФ или СБП",
  "Подключаем на ваш аккаунт ChatGPT",
  "Менеджер пишет в чат после оплаты",
] as const;

export function GptSimpleHero() {
  return (
    <section
      id="hero"
      className="flex min-h-[calc(100svh-3.5rem)] flex-col justify-center px-4 py-8 md:px-6 md:py-10"
    >
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#10a37f] md:text-sm">
            ChatGPT Go, Plus и Pro — оплата в рублях
          </p>
          <h1 className="font-heading mt-3 text-[1.65rem] font-bold leading-tight text-gray-900 md:text-4xl lg:text-[2.6rem]">
            Выберите тариф под задачу — не только Plus
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-gray-500 md:mt-4 md:text-lg">
            Go — чтобы попробовать. Plus — ежедневная работа. Pro — максимум лимитов. Карта РФ или СБП,
            без VPN и иностранной карты.
          </p>
          <ul className="mt-5 space-y-2.5 text-sm text-gray-700 md:mt-6 md:text-[15px]">
            {HERO_FEATURES.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#10a37f]" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <a
            href="#plans"
            className="mt-7 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#10a37f] px-6 text-base font-semibold text-white shadow-lg shadow-[#10a37f]/25 transition-colors hover:bg-[#0d8a6a] sm:w-auto md:mt-8"
          >
            Смотреть тарифы
            <ArrowRight className="h-5 w-5" aria-hidden />
          </a>
        </div>
        <div className="hidden min-h-[22rem] lg:block lg:min-h-[28rem]">
          <GptHeroResultCard />
        </div>
      </div>
    </section>
  );
}
