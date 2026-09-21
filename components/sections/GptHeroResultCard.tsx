"use client";

import { Check } from "lucide-react";
import { HERO_RESULT_LINES } from "@/lib/chatgpt-data";

export function GptHeroResultCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#10a37f]/30 bg-white p-6 shadow-[0_0_0_5px_rgba(16,163,127,0.06),0_20px_40px_rgba(16,163,127,0.12)] md:p-8 lg:p-10 ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 100% 0%, rgba(16,163,127,0.12) 0%, transparent 55%)",
        }}
        aria-hidden
      />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div>
          <p className="font-heading text-2xl font-semibold leading-tight text-gray-900 md:text-3xl lg:text-4xl">
            ChatGPT Plus
          </p>
          <p className="mt-3 inline-flex items-center gap-2.5 rounded-full border border-[#10a37f]/20 bg-[#10a37f]/8 px-3.5 py-1.5 text-sm font-medium text-[#0f7d62] md:mt-4 md:text-base">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10a37f] opacity-40 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#10a37f]" />
            </span>
            Подписка активна
          </p>
        </div>
        <ul className="mt-6 flex flex-1 flex-col justify-evenly gap-3 md:mt-8">
          {HERO_RESULT_LINES.map((line) => (
            <li
              key={line}
              className="flex items-center gap-3.5 text-base font-medium text-gray-800 md:text-lg lg:text-xl"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#10a37f]/12 md:h-12 md:w-12">
                <Check className="h-5 w-5 text-[#10a37f] md:h-6 md:w-6" strokeWidth={2.6} aria-hidden />
              </span>
              {line}
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-2xl bg-gray-50 px-5 py-4 md:mt-8 md:px-6 md:py-5">
          <p className="text-sm text-gray-500 md:text-base">Среднее время подключения</p>
          <p className="mt-1 font-heading text-xl font-semibold text-gray-900 md:text-2xl lg:text-3xl">
            5–15 минут
          </p>
        </div>
      </div>
    </div>
  );
}
