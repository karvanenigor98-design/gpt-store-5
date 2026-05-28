"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { createSubsBrowserClient } from "@/lib/supabase/subs-browser-client";

type Props = {
  callbackError?: string;
  siteSlug?: "subs-store" | "gpt-store";
};

export function ResetPasswordForm({ callbackError, siteSlug = "gpt-store" }: Props) {
  const [done, setDone] = useState(false);
  const [devRecoveryLink, setDevRecoveryLink] = useState<string | null>(null);
  const [notEligible, setNotEligible] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [cooldownSec, setCooldownSec] = useState(0);
  const isSubsStore = siteSlug === "subs-store";
  const accentColor = isSubsStore ? "#1DB954" : "#10a37f";
  const loginHref = isSubsStore ? "/login?site=subs-store" : "/login?site=gpt-store";

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = window.setInterval(() => {
      setCooldownSec((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [cooldownSec]);

  /** Сессия recovery уже есть (частичный успех / повторный заход) — сразу на форму нового пароля. */
  useEffect(() => {
    if (!callbackError) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = isSubsStore ? createSubsBrowserClient() : createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session || cancelled) return;
        const updateUrl = new URL("/reset-password/update", window.location.origin);
        updateUrl.searchParams.set("site", siteSlug);
        updateUrl.searchParams.set(
          "returnUrl",
          isSubsStore ? "/cabinet?site=subs-store" : "/cabinet?site=gpt-store",
        );
        window.location.replace(`${updateUrl.pathname}?${updateUrl.searchParams.toString()}`);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [callbackError, isSubsStore, siteSlug]);

  async function onSubmit(data: ResetPasswordInput) {
    if (cooldownSec > 0) return;
    setNotEligible(null);
    setWarning(null);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.email, site: siteSlug }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      reason?: string;
      channel?: string;
      recoveryLink?: string;
      error?: string;
      warning?: string;
      retryAfter?: number;
      debug?: { supabaseError?: string | null; generateLinkError?: string | null };
    };

    if (typeof json.retryAfter === "number" && json.retryAfter > 0) {
      setCooldownSec(json.retryAfter);
    }

    if (!res.ok && json.error) {
      setNotEligible(json.error);
      if (json.recoveryLink) {
        setDevRecoveryLink(json.recoveryLink);
      }
      return;
    }

    if (isSubsStore && json.reason === "no_subs_membership") {
      setNotEligible(
        `Аккаунт в Spotify Store не найден. <a href="/register?site=subs-store" style="color:#1DB954;text-decoration:underline">Зарегистрируйтесь</a>.`
      );
      return;
    }

    if (json.channel === "rate_limited_with_link" && json.recoveryLink) {
      setDevRecoveryLink(json.recoveryLink);
      setWarning(
        (json.warning ?? "Письмо временно недоступно.") +
          " Локально можно сбросить пароль по ссылке ниже.",
      );
      setDone(true);
      return;
    }

    if (json.channel === "none") {
      const hint =
        json.debug?.supabaseError ||
        json.debug?.generateLinkError ||
        "Письмо не отправлено. Проверьте Resend в .env.local или SMTP в Supabase → Authentication.";
      setNotEligible(hint);
      if (json.recoveryLink) {
        setDevRecoveryLink(json.recoveryLink);
        setNotEligible(
          `${hint}<br/><br/>Локально можно открыть ссылку сброса: <a href="${json.recoveryLink}" style="color:#1DB954;text-decoration:underline;word-break:break-all">перейти</a>`
        );
      }
      return;
    }

    setDevRecoveryLink(json.recoveryLink ?? null);
    setWarning(json.warning ?? null);
    setDone(true);
  }

  const errorClass = isSubsStore
    ? "rounded-lg border border-red-700/40 bg-red-950/50 px-3 py-2 text-sm text-red-400"
    : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600";

  if (done) {
    return (
      <div
        className="rounded-2xl border px-5 py-6 text-center"
        style={{
          borderColor: `${accentColor}40`,
          background: `${accentColor}10`,
        }}
      >
        <p className={cn("font-semibold mb-2", isSubsStore ? "text-white" : "text-gray-900")}>
          Письмо отправлено
        </p>
        <p className={cn("text-sm", isSubsStore ? "text-gray-400" : "text-gray-500")}>
          Проверьте почту (и папку «Спам») и перейдите по ссылке для создания нового пароля.
        </p>
        {warning && (
          <p className={cn("mt-3 text-xs", isSubsStore ? "text-amber-400" : "text-amber-700")}>{warning}</p>
        )}
        {devRecoveryLink && (
          <p className={cn("mt-3 text-xs break-all", isSubsStore ? "text-gray-500" : "text-gray-600")}>
            Если письма нет — локальная ссылка:{" "}
            <a href={devRecoveryLink} className="underline" style={{ color: accentColor }}>
              открыть сброс пароля
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {callbackError === "expired" && (
        <p className={errorClass}>
          Ссылка из письма истекла. Запросите новую ссылку для сброса пароля.
        </p>
      )}
      {callbackError === "callback" && (
        <p className={errorClass}>
          Ссылка недействительна. Запросите новое письмо для сброса пароля.
        </p>
      )}
      {notEligible && (
        <p
          className={errorClass}
          dangerouslySetInnerHTML={{ __html: notEligible }}
        />
      )}
      <div>
        <label className={cn("block text-sm font-medium mb-1.5", isSubsStore ? "text-gray-300" : "text-gray-700")}>
          Email
        </label>
        <input
          type="email"
          {...register("email")}
          className={cn(
            "w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-shadow",
            isSubsStore
              ? "focus:ring-2 focus:border-[#1DB954] focus:ring-[#1DB954]/30"
              : "focus:ring-2 focus:ring-[#10a37f]/30 focus:border-[#10a37f]",
            errors.email
              ? "border-red-400"
              : isSubsStore
                ? "border-white/[0.15] bg-white/[0.06] text-white placeholder:text-gray-500"
                : "border-black/[0.12]"
          )}
          placeholder="you@example.com"
        />
        {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
      </div>
      <button
        type="submit"
        disabled={isSubmitting || cooldownSec > 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: accentColor, boxShadow: `0 4px 14px ${accentColor}40` }}
      >
        {isSubmitting && <Loader2 size={15} className="animate-spin" />}
        {cooldownSec > 0 ? `Повторить через ${cooldownSec} с` : "Отправить ссылку"}
      </button>
      <p className="text-center text-sm">
        <a href={loginHref} className="hover:underline" style={{ color: accentColor }}>
          ← Вернуться к входу
        </a>
      </p>
    </form>
  );
}
