"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { completeClientAuthSession } from "@/lib/auth/completeClientAuth";
import { defaultCustomerDashboard } from "@/lib/auth/authReturnUrl";
import { buildSignupRedirectTo } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/client";
import { createSubsBrowserClient } from "@/lib/supabase/subs-browser-client";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmail";
import { registerSchema, type RegisterInput } from "@/lib/validations";
import { cn } from "@/lib/utils";

function isAlreadyRegisteredError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("already") ||
    m.includes("registered") ||
    m.includes("exists") ||
    m.includes("user already")
  );
}

function alreadyRegisteredMessage(isSubsStore: boolean): string {
  if (isSubsStore) {
    return "Этот email уже зарегистрирован. Войдите через ссылку внизу страницы.";
  }
  const login = "/login";
  const reset = "/reset-password";
  return `Этот email уже зарегистрирован. <a href="${login}" class="underline font-medium">Войти</a> или <a href="${reset}" class="underline font-medium">восстановить пароль</a>.`;
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteDirect = searchParams.get("site") ?? "";
  const returnUrlParam = searchParams.get("returnUrl");

  const siteSlug = (() => {
    if (siteDirect === "subs-store" || siteDirect === "gpt-store") {
      return siteDirect;
    }
    const ret = returnUrlParam ?? "";
    if (ret.includes("site=subs-store") || ret.includes("/spotify")) {
      return "subs-store";
    }
    if (ret.includes("site=gpt-store")) return "gpt-store";
    return "gpt-store";
  })();
  const isSubsStore = siteSlug === "subs-store";

  const returnUrl = (() => {
    const raw = returnUrlParam ?? defaultCustomerDashboard(siteSlug);
    if (!raw.startsWith("/") || raw.startsWith("//")) {
      return defaultCustomerDashboard(siteSlug);
    }
    return raw;
  })();
  const accentColor = isSubsStore ? "#1DB954" : "#10a37f";
  const accentRing = isSubsStore
    ? "focus:ring-[#1DB954]/30 focus:border-[#1DB954]"
    : "focus:ring-[#10a37f]/30 focus:border-[#10a37f]";

  const [showPass, setShowPass] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(data: RegisterInput) {
    setServerError(null);

    let supabase;
    try {
      supabase =
        isSubsStore ? createSubsBrowserClient()
        : createClient();
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Subs Auth не сконфигурирован: проверьте .env.local",
      );
      return;
    }
    // Иначе при уже открытой сессии другого пользователя PKCE/куки могут пересечься с новой регистрацией.
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    if (!isSubsStore) {
      try {
        await createSubsBrowserClient().auth.signOut({ scope: "local" });
      } catch {
        /* ignore */
      }
    } else {
      try {
        await createClient().auth.signOut({ scope: "local" });
      } catch {
        /* ignore */
      }
    }
    const normalizedEmail = normalizeEmailForAuth(data.email);

    if (typeof document !== "undefined") {
      document.cookie = `pending_signup_email=${encodeURIComponent(normalizedEmail)}; path=/; max-age=3600; samesite=lax`;
      document.cookie = `pending_signup_site=${siteSlug}; path=/; max-age=3600; samesite=lax`;
    }

    try {
      const checkRes = await fetch("/api/auth/check-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, site: siteSlug }),
      });
      const check = (await checkRes.json()) as { exists?: boolean };
      if (check.exists) {
        setServerError(alreadyRegisteredMessage(isSubsStore));
        return;
      }
    } catch {
      /* продолжаем signUp — дубль поймаем по identities / error */
    }

    const safeReturnUrl =
      returnUrl.startsWith("/") && !returnUrl.startsWith("//")
        ? returnUrl
        : defaultCustomerDashboard(siteSlug);

    const emailRedirectTo = buildSignupRedirectTo(
      siteSlug,
      safeReturnUrl,
      window.location.origin,
    );

    const { data: signData, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: data.password,
      options: {
        emailRedirectTo,
        data: { signup_site: siteSlug },
      },
    });

    if (error) {
      if (isAlreadyRegisteredError(error.message)) {
        setServerError(alreadyRegisteredMessage(isSubsStore));
      } else {
        setServerError("Не удалось создать аккаунт. Попробуйте снова.");
      }
      return;
    }

    // Supabase не отдаёт ошибку, но identities пустой — email уже в Auth (anti-enumeration)
    const hasNoIdentity =
      Array.isArray(signData.user?.identities) && signData.user?.identities.length === 0;

    if (hasNoIdentity) {
      if (signData.session) {
        await supabase.auth.signOut();
      }
      setServerError(alreadyRegisteredMessage(isSubsStore));
      return;
    }

    if (signData.session) {
      const dashboardPath = await completeClientAuthSession({
        supabase,
        site: siteSlug,
        returnUrl: safeReturnUrl,
      });
      router.replace(dashboardPath);
      router.refresh();
      return;
    }

    const sentTo = signData.user?.email ?? normalizedEmail;
    const verifyParams = new URLSearchParams({ email: sentTo, sent: "1" });
    if (isSubsStore) verifyParams.set("site", "subs-store");
    router.push(`/verify-email?${verifyParams.toString()}`);
  }

  const labelClass = isSubsStore
    ? "block text-sm font-medium mb-1.5 text-gray-300"
    : "block text-sm font-medium text-gray-700 mb-1.5";

  const inputClass = (hasError: boolean) =>
    cn(
      "w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-shadow",
      accentRing,
      hasError
        ? "border-red-500"
        : isSubsStore
          ? "border-white/[0.15] bg-white/[0.06] text-white placeholder:text-gray-500"
          : "border-black/[0.12]"
    );

  const termsHref = "/terms";
  const privacyHref = "/privacy";
  const loginHref = isSubsStore
    ? `/login?site=${siteSlug}&returnUrl=${encodeURIComponent(returnUrl)}`
    : "/login";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className={labelClass}>Email</label>
        <input
          type="email"
          autoComplete="email"
          {...register("email")}
          className={inputClass(!!errors.email)}
          placeholder="you@example.com"
        />
        {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
      </div>

      <div>
        <label className={labelClass}>Пароль</label>
        <div className="relative">
          <input
            type={showPass ? "text" : "password"}
            autoComplete="new-password"
            {...register("password")}
            className={cn(inputClass(!!errors.password), "pr-10")}
            placeholder="Минимум 8 символов"
          />
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            aria-label={showPass ? "Скрыть пароль" : "Показать пароль"}
            className={cn(
              "absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl transition-colors",
              isSubsStore ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-800",
            )}
          >
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.password && (
          <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
        )}
      </div>

      <div>
        <label className={labelClass}>Повторите пароль</label>
        <input
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
          className={inputClass(!!errors.confirmPassword)}
          placeholder="••••••••"
        />
        {errors.confirmPassword && (
          <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>
        )}
      </div>

      {serverError && (
        <p
          className="rounded-lg bg-red-950/50 border border-red-700/40 px-3 py-2 text-sm text-red-400"
          dangerouslySetInnerHTML={{ __html: serverError }}
        />
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: accentColor, boxShadow: `0 4px 14px ${accentColor}40` }}
      >
        {isSubmitting && <Loader2 size={15} className="animate-spin" />}
        {isSubmitting ? "Отправка письма…" : "Зарегистрироваться"}
      </button>

      {isSubsStore ? (
        <p className="text-center text-xs text-gray-500">
          Нажимая «Зарегистрироваться», вы принимаете условия сервиса SPOTIFY STORE.
        </p>
      ) : (
        <p className="text-center text-xs text-gray-400">
          Нажимая «Зарегистрироваться», вы соглашаетесь с{" "}
          <a href={termsHref} className="hover:underline" style={{ color: accentColor }}>
            офертой
          </a>{" "}
          и{" "}
          <a href={privacyHref} className="hover:underline" style={{ color: accentColor }}>
            политикой конфиденциальности
          </a>
          .
        </p>
      )}

      {isSubsStore && (
        <p className="text-center text-sm text-gray-400">
          Уже есть аккаунт?{" "}
          <a href={loginHref} className="hover:underline" style={{ color: accentColor }}>
            Войти
          </a>
        </p>
      )}
    </form>
  );
}
