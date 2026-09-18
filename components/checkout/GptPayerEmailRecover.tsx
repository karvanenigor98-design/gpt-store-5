"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type Props = {
  title?: string;
  hint?: string;
};

export function GptPayerEmailRecover({
  title = "Открыть чат по email заказа",
  hint = "Тот же email, что указали при оплате. Аккаунт уже создан — пароль не нужен.",
}: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/checkout/gpt/claim-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        pending?: boolean;
        redirectTo?: string;
      };
      if (json.ok && json.redirectTo) {
        router.replace(json.redirectTo);
        return;
      }
      if (json.pending) {
        setError("Оплата ещё подтверждается. Подождите минуту и повторите.");
      } else {
        setError("Не нашли оплату по этой почте. Проверьте email или откройте ссылку из письма.");
      }
    } catch {
      setError("Не удалось открыть чат. Попробуйте ещё раз.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="flex w-full max-w-sm flex-col gap-3 text-left">
      <p className="text-center text-base font-semibold text-gray-900">{title}</p>
      <p className="text-center text-sm text-gray-500">{hint}</p>
      <label className="text-sm font-medium text-gray-700">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none ring-[#10a37f] focus:border-[#10a37f] focus:ring-2"
          placeholder="you@example.com"
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#10a37f] px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Открыть чат"}
      </button>
    </form>
  );
}
