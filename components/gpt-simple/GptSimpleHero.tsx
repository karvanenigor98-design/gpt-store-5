"use client";

import { ArrowRight, Check, Clock, CreditCard, Shield, Sparkle, Star } from "lucide-react";

import { ChatGptMarkIcon } from "@/components/icons/ChatGptMarkIcon";

function scrollToPricing(): void {
  document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const BULLETS = [
  "Подключение на ваш аккаунт",
  "Без сложной регистрации",
  "Чат с менеджером после заказа",
] as const;

const VARIANTS = [
  { name: "ChatGPT Go", hint: "Для повседневных задач" },
  { name: "ChatGPT Plus", hint: "Больше возможностей" },
  { name: "ChatGPT Pro", hint: "Максимальная производительность" },
] as const;

const VARIANT_POINTS = [
  "Для разных сценариев использования",
  "Доступ ко всем нужным функциям",
  "Понятные различия между вариантами",
] as const;

const TRUST = [
  { Icon: Shield, value: "10 000+", label: "подключений" },
  { Icon: Star, value: "4,9 из 5", label: "рейтинг клиентов" },
  { Icon: CreditCard, value: "Оплата РФ / СБП", label: "без зарубежной карты" },
] as const;

export function GptSimpleHero() {
  return (
    <section id="hero" className="relative overflow-hidden px-4 pb-5 pt-4 md:px-8 md:pb-6 md:pt-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute -left-24 -top-28 h-[420px] w-[420px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(16,163,127,0.16) 0%, transparent 68%)" }}
        />
        <div
          className="absolute -right-16 top-8 h-[340px] w-[340px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(16,163,127,0.12) 0%, transparent 70%)" }}
        />
        <div className="absolute left-[18%] top-[22%] h-24 w-40 rotate-[-18deg] rounded-full bg-[#10a37f]/10" />
        <div className="absolute right-[12%] top-[8%] h-16 w-28 rotate-[22deg] rounded-full bg-[#10a37f]/10" />
        <div className="absolute bottom-[18%] left-[8%] h-20 w-32 rotate-[12deg] rounded-full bg-[#10a37f]/[0.08]" />
      </div>

      <div className="relative mx-auto grid w-full max-w-[72rem] items-stretch gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-5">
        <div className="flex flex-col justify-center rounded-[22px] bg-white px-6 py-7 shadow-[0_10px_40px_rgba(16,163,127,0.08)] md:px-9 md:py-9">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#10a37f]">
            Быстрое подключение и простой выбор
          </p>
          <h1 className="font-heading mt-3 max-w-[18ch] text-[2rem] font-bold leading-[1.12] tracking-tight text-gray-900 md:text-[2.55rem] lg:text-[2.75rem]">
            Выберите подходящий тариф для своих задач
          </h1>
          <ul className="mt-7 space-y-3">
            {BULLETS.map((line) => (
              <li key={line} className="flex items-center gap-3 text-[15px] text-gray-700 md:text-base">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#10a37f]/12">
                  <Check className="h-3.5 w-3.5 text-[#10a37f]" strokeWidth={3} aria-hidden />
                </span>
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <button
              type="button"
              onClick={scrollToPricing}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#10a37f] px-7 text-[15px] font-semibold text-white shadow-[0_8px_22px_rgba(16,163,127,0.28)] transition-opacity hover:opacity-90"
            >
              Выбрать тариф
              <ArrowRight className="h-4 w-4" strokeWidth={2.4} aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex flex-col rounded-[22px] bg-white px-5 py-6 shadow-[0_10px_40px_rgba(16,163,127,0.08)] md:px-7 md:py-7">
          <h2 className="font-heading text-[1.55rem] font-bold leading-tight text-gray-900 md:text-[1.85rem]">
            Как выбрать подходящий вариант
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 sm:gap-2.5">
            {VARIANTS.map((item) => (
              <div key={item.name} className="rounded-xl border border-[#10a37f]/12 bg-[#f7fbf9] px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#10a37f]" aria-hidden />
                  {item.name}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-gray-500">{item.hint}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex min-h-0 flex-1 items-center justify-between gap-4">
            <ul className="space-y-2.5">
              {VARIANT_POINTS.map((line) => (
                <li key={line} className="flex items-center gap-2 text-[13px] text-gray-700 md:text-sm">
                  <Check className="h-4 w-4 shrink-0 text-[#10a37f]" strokeWidth={2.8} aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
            <div className="relative shrink-0">
              <Sparkle
                className="absolute -right-1.5 -top-2 h-5 w-5 fill-amber-300 text-amber-400"
                strokeWidth={1.2}
                aria-hidden
              />
              <Sparkle
                className="absolute -right-3 top-6 h-3.5 w-3.5 fill-amber-200 text-amber-300"
                strokeWidth={1.2}
                aria-hidden
              />
              <div className="overflow-hidden rounded-2xl shadow-[0_10px_24px_rgba(16,163,127,0.22)]">
                <ChatGptMarkIcon size={92} />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-2xl bg-[#f3faf7] px-4 py-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#10a37f] shadow-sm">
                <Clock className="h-5 w-5" strokeWidth={2.1} aria-hidden />
              </span>
              <div>
                <p className="text-[11px] text-gray-500">Среднее время подключения</p>
                <p className="font-heading text-lg font-bold leading-tight text-gray-900">5–15 минут</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-[#f3faf7] px-4 py-3">
              <p className="text-sm font-medium leading-snug text-gray-800">
                Быстро
                <br />
                и без лишних шагов
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mx-auto mt-4 grid w-full max-w-[72rem] gap-3 sm:grid-cols-3 md:mt-5">
        {TRUST.map(({ Icon, value, label }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-[20px] bg-white px-4 py-3.5 shadow-[0_6px_24px_rgba(16,163,127,0.06)]"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#10a37f]/10">
              <Icon className="h-5 w-5 text-[#10a37f]" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-[1.05rem] font-bold leading-tight text-gray-900">{value}</p>
              <p className="text-[11px] leading-snug text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
