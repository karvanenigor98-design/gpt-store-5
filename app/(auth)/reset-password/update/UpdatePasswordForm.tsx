"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { completeClientAuthSession } from "@/lib/auth/completeClientAuth";
import { detectAuthSiteFromStrings } from "@/lib/auth/detectAuthSite";
import { readBrowserCookie } from "@/lib/auth/readBrowserCookie";
import { createClient } from "@/lib/supabase/client";
import { createSubsBrowserClient } from "@/lib/supabase/subs-browser-client";
import { cn } from "@/lib/utils";
import { newPasswordSchema, type NewPasswordInput } from "@/lib/validations";

export function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const siteSlug = detectAuthSiteFromStrings(
    searchParams.get("site") ?? "",
    searchParams.get("returnUrl") ?? "",
    readBrowserCookie("auth_reset_site") || readBrowserCookie("current_site"),
  );
  const isSubsStore = siteSlug === "subs-store";
  const accentColor = isSubsStore ? "#1DB954" : "#10a37f";

  const supabase = useMemo(
    () => (isSubsStore ? createSubsBrowserClient() : createClient()),
    [isSubsStore],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
  });

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setServerError(
          isSubsStore
            ? "Сессия сброса не найдена. Откройте ссылку из письма ещё раз или запросите новую на странице сброса пароля Subs Store."
            : "Сессия сброса не найдена. Откройте ссылку из письма ещё раз.",
        );
      }
    });
  }, [supabase, isSubsStore]);

  async function onSubmit(data: NewPasswordInput) {
    setServerError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setServerError(
        isSubsStore
          ? "Ссылка устарела или открыта в другом браузере. Запросите новое письмо: /reset-password?site=subs-store"
          : "Ссылка устарела. Запросите новое письмо для сброса пароля.",
      );
      return;
    }

    const newPassword = data.password;
    const { error, data: updateData } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      const lower = error.message.toLowerCase();
      if (lower.includes("same") || lower.includes("different")) {
        setServerError("Новый пароль должен отличаться от текущего.");
      } else if (lower.includes("session") || lower.includes("jwt")) {
        setServerError(
          "Сессия сброса истекла. Запросите новую ссылку на странице сброса пароля (не копируйте старую ссылку).",
        );
      } else {
        setServerError(
          process.env.NODE_ENV === "development"
            ? `Не удалось обновить пароль: ${error.message}`
            : "Не удалось обновить пароль. Запросите новую ссылку из письма.",
        );
      }
      return;
    }

    const email = updateData.user?.email ?? session.user.email ?? "";

    let {
      data: { session: activeSession },
    } = await supabase.auth.getSession();

    if (!activeSession && email) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: newPassword,
      });
      if (signInError) {
        setServerError(
          isSubsStore
            ? "Пароль не сохранился в Subs Store. Запросите новое письмо: /reset-password?site=subs-store"
            : "Пароль не сохранился. Запросите новую ссылку из письма.",
        );
        return;
      }
      ({
        data: { session: activeSession },
      } = await supabase.auth.getSession());
    }

    if (!activeSession) {
      setServerError("Сессия не создана. Войдите с новым паролем на странице входа.");
      return;
    }

    document.cookie = "auth_reset_site=; path=/; max-age=0; samesite=lax";

    const dashboardPath = await completeClientAuthSession({
      supabase,
      site: siteSlug,
      returnUrl: searchParams.get("returnUrl"),
    });

    router.replace(dashboardPath);
    router.refresh();
  }

  const labelClass = cn("mb-1.5 block text-sm font-medium", isSubsStore ? "text-gray-300" : "text-gray-700");
  const inputClass = (hasError: boolean) =>
    cn(
      "w-full rounded-xl border px-3.5 py-2.5 pr-10 text-sm outline-none transition-shadow",
      isSubsStore
        ? "focus:border-[#1DB954] focus:ring-2 focus:ring-[#1DB954]/30"
        : "focus:border-[#10a37f] focus:ring-2 focus:ring-[#10a37f]/30",
      hasError
        ? "border-red-400"
        : isSubsStore
          ? "border-white/[0.15] bg-white/[0.06] text-white placeholder:text-gray-500"
          : "border-black/[0.12]"
    );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <p
        className={cn(
          "rounded-lg border px-3 py-2 text-xs",
          isSubsStore
            ? "border-[#1DB954]/30 bg-[#1DB954]/10 text-[#a7f3c0]"
            : "border-[#10a37f]/30 bg-[#10a37f]/10 text-teal-800",
        )}
      >
        Смена пароля для: <strong>{isSubsStore ? "Subs Store (Spotify)" : "GPT STORE"}</strong>
      </p>
      <div>
        <label className={labelClass}>Новый пароль</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            {...register("password")}
            className={inputClass(!!errors.password)}
            placeholder="Минимум 8 символов"
          />
          <button
            type="button"
            className={cn("absolute right-3 top-1/2 -translate-y-1/2", isSubsStore ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600")}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
      </div>

      <div>
        <label className={labelClass}>Повторите пароль</label>
        <div className="relative">
          <input
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            {...register("confirmPassword")}
            className={inputClass(!!errors.confirmPassword)}
            placeholder="••••••••"
          />
          <button
            type="button"
            className={cn("absolute right-3 top-1/2 -translate-y-1/2", isSubsStore ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600")}
            onClick={() => setShowConfirm((v) => !v)}
          >
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>}
      </div>

      {serverError && (
        <p className={cn("rounded-lg border px-3 py-2 text-sm", isSubsStore ? "border-red-700/40 bg-red-950/50 text-red-400" : "border-red-200 bg-red-50 text-red-600")}>
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: accentColor, boxShadow: `0 4px 14px ${accentColor}40` }}
      >
        {isSubmitting && <Loader2 size={15} className="animate-spin" />}
        Сохранить новый пароль
      </button>
    </form>
  );
}
