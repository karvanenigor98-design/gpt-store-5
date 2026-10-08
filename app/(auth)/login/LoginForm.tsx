"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { fastStaffRoleFromEmail } from "@/lib/auth/fast-staff-role";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmail";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { resolveAuthReturnUrl } from "@/lib/auth/authReturnUrl";
import { getCheckoutAuthMessage } from "@/lib/checkout/checkout-intent";
import { resolvePostLoginPath } from "@/lib/auth/postLoginPath";
import { tryCreateClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

type ProxyGrant =
  | {
      access_token: string;
      refresh_token: string;
      expires_at?: number;
      expires_in?: number;
      user: { id: string; email?: string | null };
    }
  | { rejected: true };

function userFromAccessToken(access: string, email: string): { id: string; email: string } | null {
  const parts = access.split(".");
  if (parts.length < 2) return null;
  try {
    const json = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = json + "=".repeat((4 - (json.length % 4)) % 4);
    const payload = JSON.parse(atob(pad)) as { sub?: string; email?: string };
    if (!payload.sub) return null;
    return { id: payload.sub, email: payload.email || email };
  } catch {
    return null;
  }
}

async function loadGptPublicAuth(): Promise<{ url: string; anon: string } | null> {
  const bundledUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const bundledAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (bundledUrl && bundledAnon) return { url: bundledUrl.replace(/\/$/, ""), anon: bundledAnon };
  try {
    const res = await fetch("/api/auth/gpt-public", { cache: "no-store", signal: AbortSignal.timeout(5_000) });
    const json = (await res.json().catch(() => ({}))) as { url?: string; anon?: string };
    const url = (json.url ?? "").replace(/\/$/, "");
    const anon = json.anon?.trim() ?? "";
    if (!url || !anon) return null;
    return { url, anon };
  } catch {
    return null;
  }
}

async function grantViaAuthProxy(email: string, password: string, signal: AbortSignal): Promise<ProxyGrant | null> {
  const pub = await loadGptPublicAuth();
  if (!pub) return null;
  try {
    const res = await fetch("/__sb-auth/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: {
        apikey: pub.anon,
        Authorization: `Bearer ${pub.anon}`,
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({ email, password }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
      expires_in?: number;
      user?: { id: string; email?: string | null };
    };
    if (res.status === 401 || res.status === 400 || res.status === 429) return { rejected: true };
    if (!res.ok || !json.access_token || !json.refresh_token) return null;
    const user = json.user?.id ? json.user : userFromAccessToken(json.access_token, email);
    if (!user?.id) return null;
    return {
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_at: json.expires_at,
      expires_in: json.expires_in,
      user,
    };
  } catch {
    return null;
  }
}

async function grantViaBrowser(email: string, password: string): Promise<ProxyGrant | null> {
  const sb = tryCreateClient();
  if (!sb) return null;
  try {
    const result = await Promise.race([
      sb.auth.signInWithPassword({ email, password }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("timeout")), 8_000);
      }),
    ]);
    if (result.error) {
      const msg = result.error.message || "";
      if (/invalid|credentials|password|email/i.test(msg)) return { rejected: true };
      return null;
    }
    const session = result.data.session;
    if (!session?.access_token || !session.refresh_token) return null;
    const user = session.user?.id ? session.user : userFromAccessToken(session.access_token, email);
    if (!user?.id) return null;
    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      user,
    };
  } catch {
    return null;
  }
}

async function grantViaGptLoginApi(email: string, password: string, returnUrl: string): Promise<ProxyGrant | null | { ok: true; path: string; role: UserRole }> {
  try {
    const res = await fetch("/api/auth/gpt-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal: AbortSignal.timeout(22_000),
      body: JSON.stringify({ email, password, returnUrl }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      path?: string;
      role?: UserRole;
      code?: string;
    };
    if (res.ok && json.ok && typeof json.path === "string") {
      return { ok: true, path: json.path, role: json.role === "admin" || json.role === "operator" ? json.role : "client" };
    }
    if (res.status === 401 || json.code === "invalid_credentials") return { rejected: true };
    return null;
  } catch {
    return null;
  }
}

async function raceGptGrants(email: string, password: string): Promise<ProxyGrant | null> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 25_000);
  try {
    const viaProxy = await grantViaAuthProxy(email, password, ctrl.signal);
    if (viaProxy && "access_token" in viaProxy) return viaProxy;
    if (viaProxy && "rejected" in viaProxy) return viaProxy;
    return grantViaBrowser(email, password);
  } finally {
    window.clearTimeout(timer);
  }
}

function detectSite(siteDirect: string, returnUrl: string): "subs-store" | "gpt-store" {
  if (siteDirect === "gpt-store") return "gpt-store";
  if (siteDirect === "subs-store") return "subs-store";
  if (
    returnUrl.includes("site=subs-store") ||
    returnUrl.includes("/spotify")
  ) {
    return "subs-store";
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

  const effectiveReturnUrl = resolveAuthReturnUrl(returnUrl, siteSlug);
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
        let grant = await raceGptGrants(normalizedEmail, password);
        if (grant && "rejected" in grant) {
          setServerError(
            "Неверный email или пароль. Если забыли пароль — восстановите через /reset-password.",
          );
          return;
        }

        if (!grant || !("access_token" in grant)) {
          const viaApi = await grantViaGptLoginApi(normalizedEmail, password, effectiveReturnUrl);
          if (viaApi && "rejected" in viaApi) {
            setServerError(
              "Неверный email или пароль. Если забыли пароль — восстановите через /reset-password.",
            );
            return;
          }
          if (viaApi && "ok" in viaApi) {
            document.cookie = "current_site=gpt-store; path=/; max-age=2592000; samesite=lax";
            window.location.replace(viaApi.path);
            return;
          }
          setServerError("Сервер входа не ответил. Подождите 5 секунд и нажмите Войти ещё раз.");
          return;
        }

        let path: string | undefined;
        let role: UserRole = fastStaffRoleFromEmail(grant.user.email ?? normalizedEmail) ?? "client";
        try {
          const loginRes = await fetch("/api/auth/gpt-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            signal: AbortSignal.timeout(8_000),
            body: JSON.stringify({ ...grant, returnUrl: effectiveReturnUrl }),
          });
          const loginBody = (await loginRes.json().catch(() => ({}))) as {
            error?: string;
            path?: string;
            role?: UserRole;
          };
          if (loginRes.ok) {
            if (loginBody.role === "admin" || loginBody.role === "operator" || loginBody.role === "client") {
              role = loginBody.role;
            }
            if (typeof loginBody.path === "string" && loginBody.path.startsWith("/")) {
              path = loginBody.path;
            }
          }
        } catch {
          /* cookies from supabase-js may already be set */
        }

        document.cookie = "current_site=gpt-store; path=/; max-age=2592000; samesite=lax";
        const target = path ?? resolvePostLoginPath(effectiveReturnUrl, role);
        window.location.replace(target);
        return;
      } catch {
        setServerError("Сервер временно недоступен. Обновите страницу (Ctrl+F5) и попробуйте снова.");
      }
      return;
    }

    try {
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
    } catch {
      setServerError("Сервер временно недоступен. Повторите попытку через 10-20 секунд.");
    }
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
  const checkoutMessage = getCheckoutAuthMessage(effectiveReturnUrl);
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
        {checkoutMessage && !isSubsStore ? "Войти и перейти к оплате" : "Войти"}
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
