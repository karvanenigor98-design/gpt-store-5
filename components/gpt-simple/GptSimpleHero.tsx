"use client";

import { Check, Clock, CreditCard, Shield, Star, Zap } from "lucide-react";

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
    <section id="hero" className="relative overflow-hidden px-4 pb-4 pt-5 md:px-8 md:pb-6 md:pt-8">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 8% 0%, rgba(16,163,127,0.16) 0%, transparent 55%), radial-gradient(ellipse 55% 45% at 92% 8%, rgba(16,163,127,0.12) 0%, transparent 50%)",
        }}
        aria-hidden
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-stretch gap-5 lg:flex-row lg:gap-6">
        <div className="flex flex-1 flex-col justify-center rounded-[28px] border border-[#10a37f]/12 bg-white/90 p-6 shadow-[0_16px_48px_rgba(16,163,127,0.08)] backdrop-blur-sm md:p-9 lg:max-w-[52%]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#10a37f] md:text-xs">
            Быстрое подключение и простой выбор
          </p>
          <h1 className="font-heading mt-3 text-[1.85rem] font-bold leading-[1.15] text-gray-900 md:text-[2.45rem] lg:text-[2.7rem]">
            Выберите подходящий тариф для своих задач
          </h1>
          <ul className="mt-7 space-y-3.5">
            {BULLETS.map((line) => (
              <li key={line} className="flex items-center gap-3 text-[15px] text-gray-800 md:text-base">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#10a37f]">
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} aria-hidden />
                </span>
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <button
              type="button"
              onClick={scrollToPricing}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#10a37f] px-8 text-base font-semibold text-white shadow-[0_8px_24px_rgba(16,163,127,0.32)] hover:opacity-90 sm:w-auto sm:min-h-[3.25rem]"
            >
              Выбрать тариф
            </button>
          </div>
        </div>

        <div className="relative flex flex-1 flex-col gap-4 rounded-[28px] border border-[#10a37f]/12 bg-white/90 p-6 shadow-[0_16px_48px_rgba(16,163,127,0.08)] backdrop-blur-sm md:gap-5 md:p-8">
          <h2 className="font-heading shrink-0 text-xl font-bold text-gray-900 md:text-2xl">
            Как выбрать подходящий вариант
          </h2>
          <div className="grid min-h-0 flex-[1.15] gap-2 sm:grid-cols-3 sm:gap-3">
            {VARIANTS.map((item) => (
              <div
                key={item.name}
                className="flex h-full flex-col justify-center rounded-2xl border border-[#10a37f]/15 bg-[#f6fbf9] px-3 py-3"
              >
                <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10a37f]" aria-hidden />
                  {item.name}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-gray-500">{item.hint}</p>
              </div>
            ))}
          </div>
          <ul className="flex min-h-0 flex-1 flex-col justify-evenly">
            {VARIANT_POINTS.map((line) => (
              <li key={line} className="flex items-center gap-2.5 text-sm text-gray-700 md:text-[15px]">
                <Check className="h-4 w-4 shrink-0 text-[#10a37f]" strokeWidth={2.8} aria-hidden />
                {line}
              </li>
            ))}
          </ul>
          <div className="grid min-h-0 flex-[1.2] gap-3 sm:grid-cols-2">
            <div className="flex h-full items-center gap-3 rounded-2xl bg-[#f3faf7] px-4 py-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#10a37f] shadow-sm">
                <Clock className="h-5 w-5" strokeWidth={2.1} aria-hidden />
              </span>
              <div>
                <p className="text-[11px] text-gray-500">Среднее время подключения</p>
                <p className="font-heading text-base font-bold text-gray-900">5–15 минут</p>
              </div>
            </div>
            <div className="flex h-full items-center gap-3 rounded-2xl bg-[#f3faf7] px-4 py-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#10a37f] shadow-sm">
                <Zap className="h-5 w-5" strokeWidth={2.1} aria-hidden />
              </span>
              <p className="text-sm font-medium leading-snug text-gray-800">
                Быстро
                <br />
                и без лишних шагов
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mx-auto mt-5 grid w-full max-w-6xl gap-3 sm:grid-cols-3 md:mt-6 md:gap-4">
        {TRUST.map(({ Icon, value, label }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-[22px] border border-[#10a37f]/12 bg-white/95 px-4 py-3.5 shadow-sm"
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#10a37f]/12">
              <Icon className="h-5 w-5 text-[#10a37f]" strokeWidth={2.1} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-base font-bold leading-tight text-gray-900 md:text-lg">{value}</p>
              <p className="text-[11px] leading-snug text-gray-500 md:text-xs">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
