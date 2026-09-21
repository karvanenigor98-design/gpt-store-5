"use client";

import { ArrowRight, Check, Clock3, CreditCard, Shield, Star } from "lucide-react";

const LEFT_FEATURES = [
  "Подключение на ваш аккаунт",
  "Без сложной регистрации",
  "Чат с менеджером после заказа",
] as const;

const GUIDE_PLANS = [
  { name: "ChatGPT Go", hint: "Для повседневных задач" },
  { name: "ChatGPT Plus", hint: "Больше возможностей" },
  { name: "ChatGPT Pro", hint: "Максимальная производительность" },
] as const;

const GUIDE_CHECKS = [
  "Для разных сценариев использования",
  "Доступ ко всем нужным функциям",
  "Понятные различия между вариантами",
] as const;

const TRUST = [
  { value: "10 000+", label: "подключений", Icon: Shield },
  { value: "4,9 из 5", label: "рейтинг клиентов", Icon: Star },
  { value: "Оплата РФ / СБП", label: "без зарубежной карты", Icon: CreditCard },
] as const;

function CheckDot() {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#10a37f]/15">
      <Check className="h-3 w-3 text-[#10a37f]" strokeWidth={3} aria-hidden />
    </span>
  );
}

function ChatGptCube() {
  return (
    <div className="relative h-[7.25rem] w-[7.25rem] shrink-0">
      <span
        className="absolute -right-1 top-2 h-3 w-3 rotate-45 bg-[#10a37f]/70"
        aria-hidden
      />
      <span
        className="absolute -top-1 right-7 h-2 w-2 rotate-45 bg-[#10a37f]/50"
        aria-hidden
      />
      <div
        className="flex h-full w-full items-center justify-center rounded-[1.35rem] shadow-[0_18px_40px_rgba(16,163,127,0.28)]"
        style={{
          background: "linear-gradient(145deg, #5ee0b4 0%, #10a37f 52%, #0b7d61 100%)",
        }}
      >
        <svg viewBox="0 0 2406 2406" className="h-16 w-16 text-white" aria-hidden>
          <path
            id="gpt-blade"
            d="M1107.3 299.1c-197.999 0-373.9 127.3-435.2 315.3L650 743.5v427.9c0 21.4 11 40.4 29.4 51.4l344.5 198.515V833.3h.1v-27.9L1372.7 604c33.715-19.52 70.44-32.857 108.47-39.828L1447.6 450.3C1361 353.5 1237.1 298.5 1107.3 299.1zm0 117.5-.6.6c79.699 0 156.3 27.5 217.6 78.4-2.5 1.2-7.4 4.3-11 6.1L952.8 709.3c-18.4 10.4-29.4 30-29.4 51.4V1248l-155.1-89.4V755.8c-.1-187.099 151.601-338.9 339-339.2z"
            fill="currentColor"
          />
          <use href="#gpt-blade" transform="rotate(60 1203 1203)" />
          <use href="#gpt-blade" transform="rotate(120 1203 1203)" />
          <use href="#gpt-blade" transform="rotate(180 1203 1203)" />
          <use href="#gpt-blade" transform="rotate(240 1203 1203)" />
          <use href="#gpt-blade" transform="rotate(300 1203 1203)" />
        </svg>
      </div>
    </div>
  );
}

export function GptSimpleHero() {
  return (
    <section id="hero" className="relative overflow-hidden px-4 pb-4 pt-5 md:px-6 md:pb-5 md:pt-7">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-24 top-8 h-72 w-72 rounded-[3rem] bg-[#c9f3e3] opacity-80" />
        <div className="absolute right-[-4rem] top-[-2rem] h-80 w-[28rem] rotate-[-18deg] rounded-[4rem] bg-[#d7f6ea]" />
        <div className="absolute bottom-8 left-[38%] h-40 w-56 rotate-12 rounded-[2.5rem] bg-[#c3eedd]/80" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="grid items-stretch gap-4 lg:grid-cols-2 lg:gap-5">
          <article className="flex flex-col rounded-[1.75rem] bg-white p-6 shadow-[0_12px_40px_rgba(16,163,127,0.08)] md:p-8 lg:p-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#10a37f] md:text-xs">
              Быстрое подключение и простой выбор
            </p>
            <h1 className="font-heading mt-3 text-[1.85rem] font-bold leading-[1.12] tracking-tight text-gray-900 md:text-4xl lg:text-[2.55rem]">
              Выберите подходящий тариф для своих задач
            </h1>
            <ul className="mt-6 flex-1 space-y-3 text-[15px] text-gray-500 md:mt-7 md:text-base">
              {LEFT_FEATURES.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <CheckDot />
                  {item}
                </li>
              ))}
            </ul>
            <a
              href="#plans"
              className="mt-auto inline-flex min-h-[3.25rem] w-auto self-start items-center justify-center gap-2 rounded-full bg-[#10a37f] px-8 text-base font-semibold text-white shadow-[0_10px_24px_rgba(16,163,127,0.28)] transition-colors hover:bg-[#0d8a6a]"
            >
              Выбрать тариф
              <ArrowRight className="h-5 w-5" aria-hidden />
            </a>
          </article>

          <article className="flex flex-col rounded-[1.75rem] bg-white p-6 shadow-[0_12px_40px_rgba(16,163,127,0.08)] md:p-8 lg:p-9">
            <h2 className="font-heading text-[1.65rem] font-bold leading-tight text-gray-900 md:text-[1.85rem]">
              Как выбрать подходящий вариант
            </h2>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {GUIDE_PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className="rounded-2xl border border-black/[0.06] bg-[#f7fbf9] px-2.5 py-3 md:px-3"
                >
                  <p className="flex items-start gap-1.5 text-[11px] font-semibold leading-snug text-gray-900 md:text-xs">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#10a37f]" aria-hidden />
                    {plan.name}
                  </p>
                  <p className="mt-1 pl-3 text-[10px] leading-snug text-gray-400 md:text-[11px]">{plan.hint}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-end justify-between gap-4">
              <ul className="min-w-0 space-y-2.5 text-[13px] text-gray-600 md:text-[15px]">
                {GUIDE_CHECKS.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckDot />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <ChatGptCube />
            </div>
            <div className="mt-6 flex items-center justify-between gap-3 rounded-[1.25rem] bg-[#f4faf7] px-4 py-3.5 md:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                  <Clock3 className="h-5 w-5 text-[#10a37f]" aria-hidden />
                </span>
                <div>
                  <p className="text-[11px] text-gray-400 md:text-xs">Среднее время подключения</p>
                  <p className="font-heading text-xl font-bold leading-none text-gray-900 md:text-2xl">
                    5–15 минут
                  </p>
                </div>
              </div>
              <p className="hidden w-[6.75rem] shrink-0 text-right text-xs leading-snug text-gray-400 sm:block">
                Быстро и без лишних шагов
              </p>
            </div>
          </article>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {TRUST.map(({ value, label, Icon }) => (
            <div
              key={value}
              className="flex items-center gap-3 rounded-[1.35rem] bg-white px-5 py-4 shadow-[0_8px_28px_rgba(16,163,127,0.06)]"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#10a37f]/10">
                <Icon className="h-5 w-5 text-[#10a37f]" strokeWidth={2.1} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-heading text-base font-bold leading-tight text-gray-900 md:text-lg">{value}</p>
                <p className="text-xs text-gray-400 md:text-sm">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
