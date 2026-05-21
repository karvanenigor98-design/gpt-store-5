"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { defaultCustomerDashboard } from "@/lib/auth/authReturnUrl";
import { completeClientAuthSession } from "@/lib/auth/completeClientAuth";
import { createClient } from "@/lib/supabase/client";
import { createSubsBrowserClient } from "@/lib/supabase/subs-browser-client";

const RESEND_COOLDOWN_SEC = 30;
const POLL_MS = 2500;

const SPOTIFY_GREEN = "#1DB954";

function mapQueryError(
  param: string | null,
): "expired" | "used" | "callback" | "wrong_account" | null {
  if (
    param === "expired" ||
    param === "used" ||
    param === "callback" ||
    param === "wrong_account"
  ) {
    return param;
  }
  return null;
}

function errorBannerText(kind: "expired" | "used" | "callback" | "wrong_account"): string {
  if (kind === "expired") return "Ссылка истекла. Отправьте письмо ещё раз.";
  if (kind === "used") return "Аккаунт уже подтверждён";
  if (kind === "wrong_account") {
    return "В браузере была активна другая учётная запись. Выйдите из всех аккаунтов на сайте, откройте ссылку из письма снова или зарегистрируйтесь в режиме инкогнито.";
  }
  return "Не удалось подтвердить email. Запросите новое письмо.";
}

function mapResendError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Слишком часто запрашиваете письмо. Подождите немного и попробуйте снова.";
  }
  if (m.includes("already") || m.includes("confirmed")) {
    return "Аккаунт уже подтверждён. Повторная отправка письма не требуется.";
  }
  return "Не удалось отправить письмо повторно. Попробуйте позже.";
}

export function VerifyEmailClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const email = (searchParams.get("email") ?? "").trim();
  const queryErr = mapQueryError(searchParams.get("error"));
  const justSentParam = searchParams.get("sent") === "1";
  const flowCheckInbox = searchParams.get("flow") === "check_inbox";
  const autoloadConfirm = searchParams.get("autoload") === "1";
  const siteParam = searchParams.get("site") ?? "";
  const siteSlug = siteParam === "subs-store" ? "subs-store" : "gpt-store";
  const isSubsStore = siteSlug === "subs-store";
  const accentColor = isSubsStore ? SPOTIFY_GREEN : "#10a37f";
  const postLoginTarget = defaultCustomerDashboard(siteSlug);

  function getAuthClient() {
    return isSubsStore ? createSubsBrowserClient() : createClient();
  }

  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN_SEC);
  const [resendPhase, setResendPhase] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resendError, setResendError] = useState<string | null>(null);
  const [entryPhase, setEntryPhase] = useState<"none" | "entering">("none");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [showJustSent, setShowJustSent] = useState(false);
  const didRedirect = useRef(false);
  const strippedSent = useRef(false);
  const firstPollDone = useRef(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  useEffect(() => {
    if (!justSentParam || strippedSent.current) return;
    strippedSent.current = true;
    setShowJustSent(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("sent");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [justSentParam, pathname, router, searchParams]);

  const syncAndGo = useCallback(async () => {
    if (didRedirect.current) return;

    let supabase;
    try {
      supabase = getAuthClient();
    } catch {
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email_confirmed_at) return;

    didRedirect.current = true;
    setEntryPhase("entering");

    const target = await completeClientAuthSession({
      supabase,
      site: siteSlug,
      returnUrl: postLoginTarget,
    });

    router.replace(target);
    router.refresh();
  }, [router, siteSlug, postLoginTarget, isSubsStore]);

  useEffect(() => {
    let supabase;
    try {
      supabase = getAuthClient();
    } catch {
      setSessionChecked(true);
      return;
    }

    const poll = async () => {
      if (didRedirect.current) return;
      try {
        await supabase.auth.getSession();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.email_confirmed_at) {
          await syncAndGo();
        }
      } catch {
        // Supabase может временно вернуть ошибку refresh token;
        // в этом случае продолжаем polling и не блокируем интерфейс.
      } finally {
        if (!firstPollDone.current) {
          firstPollDone.current = true;
          setSessionChecked(true);
        }
      }
    };

    const interval = setInterval(() => void poll(), POLL_MS);
    void poll();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session?.user?.email_confirmed_at) void syncAndGo();
    });

    return () => {
      clearInterval(interval);
      sub.subscription.unsubscribe();
    };
  }, [syncAndGo]);

  // After email link → /auth/callback → redirect here with session already established
  useEffect(() => {
    if (!autoloadConfirm || !isSubsStore) return;
    let cancelled = false;
    void (async () => {
      let supabase;
      try {
        supabase = getAuthClient();
      } catch {
        return;
      }
      await supabase.auth.getSession();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || didRedirect.current || !user?.email_confirmed_at) return;
      await syncAndGo();
    })();
    return () => {
      cancelled = true;
    };
  }, [autoloadConfirm, isSubsStore, syncAndGo]);

  async function handleResend() {
    if (!email || resendIn > 0 || resendPhase === "sending") return;
    setResendPhase("sending");
    setResendError(null);
    let supabase;
    try {
      supabase = getAuthClient();
    } catch {
      setResendPhase("error");
      setResendError("Auth не настроен. Проверьте .env.local");
      return;
    }
    const callbackUrl = `${window.location.origin}/auth/callback?site=${siteSlug}&returnUrl=${encodeURIComponent(postLoginTarget)}`;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: callbackUrl },
    });
    if (error) {
      setResendPhase("error");
      setResendError(mapResendError(error.message));
      return;
    }
    setResendPhase("sent");
    setResendIn(RESEND_COOLDOWN_SEC);
  }

  const iconBg = isSubsStore ? `${SPOTIFY_GREEN}18` : "rgba(16,163,127,0.1)";
  const spinnerColor = isSubsStore ? SPOTIFY_GREEN : "#10a37f";
  const headingClass = isSubsStore ? "text-white" : "text-gray-900";
  const subTextClass = isSubsStore ? "text-gray-400" : "text-gray-500";

  if (!sessionChecked) {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: iconBg }}>
          <Loader2 size={28} className="animate-spin" style={{ color: spinnerColor }} />
        </div>
        <h1 className={`font-heading text-2xl font-bold mb-2 ${headingClass}`}>Загрузка</h1>
        <p className={`text-sm ${subTextClass}`}>Проверяем сессию…</p>
      </div>
    );
  }

  if (entryPhase === "entering") {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: iconBg }}>
          <Loader2 size={28} className="animate-spin" style={{ color: spinnerColor }} />
        </div>
        <h1 className={`font-heading text-2xl font-bold mb-2 ${headingClass}`}>Вы зарегистрированы!</h1>
        <p className={`text-sm ${subTextClass}`}>
          Открываем{" "}
          {isSubsStore ? (
            <span style={{ color: SPOTIFY_GREEN }}>Subs Store</span>
          ) : "личный кабинет"}
          …
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: iconBg }}>
        {resendPhase === "sending" ? (
          <Loader2 size={26} className="animate-spin" style={{ color: spinnerColor }} />
        ) : (
          <MailCheck size={26} style={{ color: spinnerColor }} />
        )}
      </div>
      <h1 className={`font-heading text-2xl font-bold mb-3 ${headingClass}`}>
        {flowCheckInbox && isSubsStore ? "Завершите регистрацию" : "Проверьте почту"}
      </h1>
      {queryErr && (
        <p className={`mb-4 rounded-lg border px-3 py-2 text-sm ${isSubsStore ? "border-red-700/40 bg-red-950/50 text-red-400" : "border-red-200 bg-red-50 text-red-700"}`}>
          {errorBannerText(queryErr)}
        </p>
      )}
      {showJustSent && (
        <p
          className="mb-3 rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: `${accentColor}40`, background: `${accentColor}15`, color: isSubsStore ? "#a7f3c0" : "#0f766e" }}
        >
          Письмо отправлено
        </p>
      )}
      <p className={`text-sm leading-relaxed mb-6 ${subTextClass}`}>
        {flowCheckInbox && isSubsStore ? (
          <>
            Мы отправили инструкции на указанный адрес. Откройте письмо и подтвердите email — после этого вы
            автоматически попадёте в личный кабинет Subs Store.
          </>
        ) : (
          <>
            Мы отправили письмо для подтверждения регистрации. Откройте письмо и нажмите «Подтвердить email».
            После подтверждения вы автоматически попадёте в личный кабинет
            {isSubsStore ? " Subs Store" : ""}.
          </>
        )}
      </p>
      {email ? (
        <div className="mb-6 space-y-3 text-left">
          <p className={`text-xs break-all ${isSubsStore ? "text-gray-500" : "text-gray-400"}`}>
            Отправлено на: {email}
          </p>
          {resendPhase === "sending" && (
            <p className={`text-xs ${subTextClass}`}>Письмо отправляется…</p>
          )}
          {resendPhase === "sent" && (
            <p className="text-xs" style={{ color: isSubsStore ? "#a7f3c0" : "#0f766e" }}>
              Письмо отправлено повторно
            </p>
          )}
          {resendPhase === "error" && resendError && (
            <p className={`text-xs ${isSubsStore ? "text-red-400" : "text-red-600"}`}>{resendError}</p>
          )}
          <button
            type="button"
            disabled={resendIn > 0 || resendPhase === "sending"}
            onClick={() => void handleResend()}
            className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-opacity disabled:opacity-50 ${isSubsStore ? "border-white/[0.15] text-gray-300 hover:bg-white/[0.06]" : "border-black/[0.12] text-gray-800 hover:bg-gray-50"}`}
          >
            {resendPhase === "sending" && <Loader2 size={15} className="animate-spin" />}
            {resendIn > 0 ? `Отправить повторно через ${resendIn} с` : "Отправить повторно"}
          </button>
        </div>
      ) : (
        <p className={`mb-6 text-xs ${isSubsStore ? "text-amber-400" : "text-amber-800"}`}>
          Не указан email. Вернитесь к{" "}
          <a href={`/register?site=${siteSlug}`} className="hover:underline" style={{ color: accentColor }}>
            регистрации
          </a>
          .
        </p>
      )}
      <p className={`text-xs ${isSubsStore ? "text-gray-600" : "text-gray-400"}`}>
        Не нашли письмо? Проверьте папку «Спам».
      </p>
    </div>
  );
}
