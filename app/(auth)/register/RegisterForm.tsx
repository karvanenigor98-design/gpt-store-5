"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { defaultCustomerDashboard } from "@/lib/auth/authReturnUrl";
import { createClient } from "@/lib/supabase/client";
import { createSubsBrowserClient } from "@/lib/supabase/subs-browser-client";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmail";
import { registerSchema, type RegisterInput } from "@/lib/validations";
import { isCheckoutReturnPath } from "@/lib/checkout/checkout-intent";
import { cn } from "@/lib/utils";

function alreadyRegisteredMessage(isSubsStore: boolean, unconfirmed?: boolean): string {
  if (unconfirmed) {
    return "Аккаунт уже создан, но email не подтверждён. Мы отправим письмо повторно — проверьте почту.";
  }
  if (isSubsStore) {
    return "Этот email уже зарегистрирован. Войдите через ссылку внизу страницы.";
  }
  const login = "/login";
  const reset = "/reset-password";
  return `Этот email уже зарегистрирован. <a href="${login}" class="underline font-medium">Войти</a> или <a href="${reset}" class="underline font-medium">восстановить пароль</a>.`;
}

function buildVerifyEmailUrl(
  email: string,
  siteSlug: string,
  safeReturnUrl: string,
  params: { sent?: boolean; pending?: boolean },
): string {
  const verifyParams = new URLSearchParams({ email });
  if (params.sent) verifyParams.set("sent", "1");
  if (params.pending) verifyParams.set("pending", "1");
  if (siteSlug === "subs-store") verifyParams.set("site", "subs-store");
  if (safeReturnUrl.startsWith("/") && !safeReturnUrl.startsWith("//")) {
    verifyParams.set("returnUrl", safeReturnUrl);
  }
  if (isCheckoutReturnPath(safeReturnUrl)) verifyParams.set("flow", "checkout");
  return `/verify-email?${verifyParams.toString()}`;
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

  async function clearLocalAuthSessions() {
    try {
      const primary = isSubsStore ? createSubsBrowserClient() : createClient();
      await primary.auth.signOut({ scope: "local" }).catch(() => undefined);
    } catch {
      /* ignore */
    }
    try {
      const secondary = isSubsStore ? createClient() : createSubsBrowserClient();
      await secondary.auth.signOut({ scope: "local" }).catch(() => undefined);
    } catch {
      /* ignore */
    }
  }

  async function onSubmit(data: RegisterInput) {
    setServerError(null);

    await clearLocalAuthSessions();

    const normalizedEmail = normalizeEmailForAuth(data.email);
    const safeReturnUrl =
      returnUrl.startsWith("/") && !returnUrl.startsWith("//")
        ? returnUrl
        : defaultCustomerDashboard(siteSlug);

    if (typeof document !== "undefined") {
      document.cookie = `pending_signup_email=${encodeURIComponent(normalizedEmail)}; path=/; max-age=3600; samesite=lax`;
      document.cookie = `pending_signup_site=${siteSlug}; path=/; max-age=3600; samesite=lax`;
    }

    let signupRes: Response;
    try {
      signupRes = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password: data.password,
          site: siteSlug,
          returnUrl: safeReturnUrl,
        }),
      });
    } catch {
      setServerError("Не удалось связаться с сервером. Проверьте интернет и попробуйте снова.");
      return;
    }

    const signupJson = (await signupRes.json().catch(() => ({}))) as {
      ok?: boolean;
      code?: string;
      error?: string;
      needsVerification?: boolean;
      emailSent?: boolean;
      deliveryPending?: boolean;
      email?: string;
    };

    if (!signupRes.ok || !signupJson.ok) {
      if (signupJson.code === "already_registered") {
        setServerError(alreadyRegisteredMessage(isSubsStore));
        return;
      }
      setServerError(signupJson.error ?? "Не удалось создать аккаунт. Попробуйте снова.");
      return;
    }

    if (signupJson.needsVerification) {
      const sentTo = signupJson.email ?? normalizedEmail;
      router.push(
        buildVerifyEmailUrl(sentTo, siteSlug, safeReturnUrl, {
          sent: Boolean(signupJson.emailSent),
          pending: Boolean(signupJson.deliveryPending),
        }),
      );
      return;
    }

    router.push(`/login?site=${siteSlug}&returnUrl=${encodeURIComponent(safeReturnUrl)}`);
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
  const loginHref = `/login?site=${siteSlug}&returnUrl=${encodeURIComponent(returnUrl)}`;

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
        {isSubmitting ? "Создание аккаунта…" : "Зарегистрироваться"}
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

      <p className="text-center text-sm text-gray-400">
        Уже есть аккаунт?{" "}
        <a href={loginHref} className="hover:underline" style={{ color: accentColor }}>
          Войти
        </a>
      </p>
    </form>
  );
}
