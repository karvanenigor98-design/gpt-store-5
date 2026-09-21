"use client";

const STEPS = [
  {
    n: "1",
    title: "Оплатите в рублях",
    text: "Карта РФ или СБП — без иностранной карты.",
  },
  {
    n: "2",
    title: "Менеджер сам напишет в чат",
    text: "После оплаты напишем на сайте и поможем с подключением.",
  },
  {
    n: "3",
    title: "Plus на вашем аккаунте",
    text: "Подключаем план на ваш аккаунт ChatGPT.",
  },
] as const;

export function GptSimpleHowItWorks() {
  return (
    <section id="how-it-works" className="px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-heading text-center text-2xl font-bold text-gray-900 md:text-3xl">
          От оплаты до Plus на аккаунте — три шага
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3 md:gap-5">
          {STEPS.map(({ n, title, text }) => (
            <article key={title} className="rounded-2xl bg-white p-5">
              <span className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#10a37f] text-sm font-bold text-white">
                {n}
              </span>
              <h3 className="font-heading text-lg font-semibold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500 md:text-[15px]">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
