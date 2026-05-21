import Link from "next/link";

import {
  getGptStoreLandingPath,
  getGptStoreLandingUrl,
  getSubsStoreLandingPath,
  getSubsStoreLandingUrl,
} from "@/lib/store-urls";

export default function NotFound() {
  const subsHref = getSubsStoreLandingPath();
  const gptHref = getGptStoreLandingPath();
  const subsFull = getSubsStoreLandingUrl();
  const gptFull = getGptStoreLandingUrl();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">404</p>
      <h1 className="mt-2 font-heading text-2xl font-bold text-gray-900">Страница не найдена</h1>
      <p className="mt-3 max-w-sm text-sm text-gray-600">
        Проверьте адрес или вернитесь на главную нужного магазина.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={subsHref}
          className="rounded-xl bg-[#1DB954] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Subs Store
        </Link>
        <Link
          href={gptHref}
          className="rounded-xl bg-[#10a37f] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          GPT STORE
        </Link>
      </div>
      {process.env.NODE_ENV === "development" && (
        <p className="mt-6 max-w-md text-xs text-gray-400">
          Dev: Subs — <span className="font-mono">{subsFull}</span>
          <br />
          GPT — <span className="font-mono">{gptFull}</span> или <span className="font-mono">/gpt</span> на порту
          3055
        </p>
      )}
    </div>
  );
}
