"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createSubsBrowserClient } from "@/lib/supabase/subs-browser-client";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmail";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { normalizeAuthReturnUrl } from "@/lib/auth/authReturnUrl";
import { getCheckoutAuthMessage } from "@/lib/checkout/checkout-intent";
import { resolvePostLoginPath } from "@/lib/auth/postLoginPath";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

function detectSite(siteDirect: string, returnUrl: string): "subs-store" | "gpt-store" {
  if (typeof window !== "undefined") {
    const port = window.location.port;
    if (port === "3056") return "gpt-store";
    if (port === "3055") return "subs-store";
  }
  if (siteDirect === "gpt-store") return "gpt-store";
  if (siteDirect === "subs-store") return "subs-store";
  if (
    returnUrl.includes("site=subs-store") ||
    returnUrl.includes("/spotify")
  ) {
    return typeof window !== "undefined" && window.location.port === "3056"
      ? "gpt-store"
      : "subs-store";
  }
  return "gpt-store";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = (searchParams.get("email") ?? "").trim();
  const rawReturnUrl = searchParams.get("returnUrl") ?? "/cabinet";
  const siteDirect = searchParams.get("site") ?? "";
  const returnUrl =
    rawReturnUrl.startsWith("/") && !rawReturnUrl.startsWith("//")
      ? rawReturnUrl
      : "/cabinet";

  const siteSlug = detectSite(siteDirect, returnUrl);
  const isSubsStore = siteSlug === "subs-store";
  const accentColor = isSubsStore ? "#1DB954" : "#10a37f";

  // For Subs Store: if returnUrl is the generic /cabinet fallback, replace with site-aware path
  const effectiveReturnUrl = normalizeAuthReturnUrl(returnUrl, siteSlug);
  const accentRing = isSubsStore
    ? "focus:ring-[#1DB954]/30 focus:border-[#1DB954]"
    : "focus:ring-[#10a37f]/30 focus:border-[#10a37f]";

  const [showPass, setShowPass] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const authError = searchParams.get("error");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: initialEmail, password: "" },
  });

  async function onSubmit(data: LoginInput) {
    setServerError(null);
    const normalizedEmail = normalizeEmailForAuth(data.email);
    const password = data.password;

    if (!isSubsStore) {
      try {
        await createSubsBrowserClient().auth.signOut({ scope: "local" });
      } catch {
        /* ignore */
      }

      const loginRes = await fetch("/api/auth/gpt-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          returnUrl: effectiveReturnUrl,
        }),
      });

      const loginBody = (await loginRes.json().catch(() => ({}))) as {
        error?: string;
        path?: string;
        role?: UserRole;
      };

      if (!loginRes.ok) {
        setServerError(
          loginBody.error ??
            "Не удалось войти в GPT STORE. Попробуйте снова или восстановите пароль.",
        );
        return;
      }

      document.cookie = "current_site=gpt-store; path=/; max-age=2592000; samesite=lax";
      const role: UserRole =
        loginBody.role === "admin" || loginBody.role === "operator" || loginBody.role === "client"
          ? loginBody.role
          : "client";
      const target =
        typeof loginBody.path === "string" && loginBody.path.startsWith("/")
          ? loginBody.path
          : resolvePostLoginPath(effectiveReturnUrl, role);
      router.push(target);
      router.refresh();
      return;
    }

    try {
      await createClient().auth.signOut({ scope: "local" });
    } catch {
      /* ignore */
    }

    const loginRes = await fetch("/api/auth/subs-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email: normalizedEmail,
        password,
        returnUrl: effectiveReturnUrl,
      }),
    });

    const loginBody = (await loginRes.json().catch(() => ({}))) as {
      error?: string;
      path?: string;
      role?: UserRole;
    };

    if (!loginRes.ok) {
      setServerError(
        loginBody.error ??
          "Не удалось войти в Spotify Store. Проверьте email и пароль или восстановите пароль.",
      );
      return;
    }

    document.cookie = "current_site=subs-store; path=/; max-age=2592000; samesite=lax";

    const role: UserRole =
      loginBody.role === "admin" || loginBody.role === "operator" || loginBody.role === "client"
        ? loginBody.role
        : "client";

    const target =
      typeof loginBody.path === "string" && loginBody.path.startsWith("/")
        ? loginBody.path
        : resolvePostLoginPath(effectiveReturnUrl, role);
    router.push(target);
    router.refresh();
  }

  function onInvalid() {
    setServerError("Заполните email и пароль, затем попробуйте снова.");
  }

  useEffect(() => {
    const resetStatus = searchParams.get("reset");
    const verifiedStatus = searchParams.get("verified");
    const fromSignup = searchParams.get("from") === "signup";
    if (resetStatus === "success") {
      setNotice("Пароль успешно обновлен. Теперь войдите с новым паролем.");
    } else if (verifiedStatus === "1" && fromSignup) {
      setNotice(
        "Почта подтверждена, регистрация завершена. Войдите с тем же email и паролем, что указали при регистрации."
      );
    } else if (verifiedStatus === "1") {
      setNotice("Email подтвержден. Теперь вы можете войти в кабинет.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authError) return;
    setServerError("Не удалось выполнить вход. Попробуйте еще раз.");
  }, [authError]);

  const inputBase = cn(
    "w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-shadow",
    accentRing
  );

  const labelClass = isSubsStore
    ? "block text-sm font-medium mb-1.5 text-gray-300"
    : "block text-sm font-medium text-gray-700 mb-1.5";
  const inputClass = (hasError: boolean) =>
    cn(
      inputBase,
      hasError
        ? "border-red-500"
        : isSubsStore
          ? "border-white/[0.15] bg-white/[0.06] text-white placeholder:text-gray-500"
          : "border-black/[0.12]"
    );

  const resetHref = isSubsStore ? `/reset-password?site=${siteSlug}` : "/reset-password";
  const checkoutMessage = getCheckoutAuthMessage(effectiveReturnUrl, siteSlug);
  const registerHref = `/register?site=${siteSlug}&returnUrl=${encodeURIComponent(effectiveReturnUrl)}`;

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
      {checkoutMessage ? (
        <p
          className="rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: `${accentColor}40`,
            background: `${accentColor}12`,
            color: isSubsStore ? "#a7f3c0" : "#0f766e",
          }}
        >
          {checkoutMessage}
        </p>
      ) : null}
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
        <div className="flex items-center justify-between mb-1.5">
          <label
            className={
              isSubsStore
                ? "block text-sm font-medium text-gray-300"
                : "block text-sm font-medium text-gray-700"
            }
          >
            Пароль
          </label>
          <a href={resetHref} className="text-xs hover:underline" style={{ color: accentColor }}>
            Забыли пароль?
          </a>
        </div>
        <div className="relative">
          <input
            type={showPass ? "text" : "password"}
            autoComplete="current-password"
            {...register("password")}
            className={cn(inputClass(!!errors.password), "pr-10")}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            aria-label={showPass ? "Скрыть пароль" : "Показать пароль"}
            className={cn(
              "absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl transition-colors",
              isSubsStore
                ? "text-gray-400 hover:text-gray-200"
                : "text-gray-500 hover:text-gray-800",
              showPass && !isSubsStore && "text-gray-800",
            )}
            style={showPass && isSubsStore ? { color: accentColor } : undefined}
          >
            {showPass ? <EyeOff size={18} strokeWidth={2.25} /> : <Eye size={18} strokeWidth={2.25} />}
          </button>
        </div>
        {errors.password && (
          <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
        )}
      </div>

      {serverError && (
        <p
          className="rounded-lg bg-red-950/50 border border-red-700/40 px-3 py-2 text-sm text-red-400"
          dangerouslySetInnerHTML={{ __html: serverError }}
        />
      )}
      {notice && (
        <p
          className="rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: `${accentColor}40`,
            background: `${accentColor}15`,
            color: isSubsStore ? "#a7f3c0" : "#0f766e",
          }}
        >
          {notice}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: accentColor, boxShadow: `0 4px 14px ${accentColor}40` }}
      >
        {isSubmitting && <Loader2 size={15} className="animate-spin" />}
        Войти
      </button>

      <p className={cn("text-center text-sm", isSubsStore ? "text-gray-400" : "text-gray-500")}>
        Нет аккаунта?{" "}
        <a href={registerHref} className="hover:underline" style={{ color: accentColor }}>
          Зарегистрироваться
        </a>
      </p>
    </form>
  );
}
