"use client";

import { CreditCard, Mail, MessageCircle } from "lucide-react";

const STEPS = [
  {
    n: "1",
    title: "Выберите тариф",
    text: "Go, Plus или Pro — под задачу, со входом в аккаунт или без.",
    Icon: CreditCard,
  },
  {
    n: "2",
    title: "Укажите email и оплатите",
    text: "Карта РФ или СБП. Регистрация и пароль до оплаты не нужны.",
    Icon: Mail,
  },
  {
    n: "3",
    title: "ChatGPT на вашем аккаунте",
    text: "Подписку подключаем на аккаунт клиента.",
    Icon: MessageCircle,
  },
] as const;

export function GptSimpleHowItWorks() {
  return (
    <section id="how-it-works" className="px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-heading text-center text-2xl font-bold text-gray-900 md:text-3xl">
          Три шага до доступа
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-gray-500 md:text-base">
          Подписка ChatGPT — на аккаунте клиента. После оплаты — письмо: чат и кабинет.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3 md:gap-5">
          {STEPS.map(({ n, title, text, Icon }) => (
            <article
              key={title}
              className="rounded-2xl border border-[#10a37f]/15 bg-white p-5 shadow-sm md:p-6"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#10a37f] text-sm font-bold text-white">
                  {n}
                </span>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#10a37f]/12">
                  <Icon className="h-7 w-7 text-[#10a37f]" strokeWidth={2} aria-hidden />
                </span>
              </div>
              <h3 className="font-heading text-lg font-semibold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500 md:text-[15px]">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
