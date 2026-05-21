"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { detectAuthSiteFromStrings } from "@/lib/auth/detectAuthSite";
import { readBrowserCookie } from "@/lib/auth/readBrowserCookie";
import { createClient } from "@/lib/supabase/client";
import { createSubsBrowserClient } from "@/lib/supabase/subs-browser-client";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

const SUBS_GREEN = "#1DB954";

function parseHashParams(hash: string): Record<string, string> {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(h);
  const out: Record<string, string> = {};
  params.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

async function tryApplySessionFromUrlHash(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const raw = window.location.hash;
  if (!raw || raw.length < 2) return false;
  const p = parseHashParams(raw);
  const access_token = p.access_token;
  const refresh_token = p.refresh_token;
  if (!access_token || !refresh_token) return false;
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  return !error;
}

function stripUrlHash() {
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", `${pathname}${search}`);
}

async function waitForImplicitSession(supabase: SupabaseClient<Database>) {
  const timeoutMs = 5000;
  const started = Date.now();

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let sub: { unsubscribe: () => void } | null = null;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      sub?.unsubscribe();
      resolve(ok);
    };

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session &&
        (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED")
      ) {
        finish(true);
      }
    });
    sub = data.subscription;

    void (async () => {
      while (Date.now() - started < timeoutMs && !settled) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          finish(true);
          return;
        }
        await new Promise((r) => setTimeout(r, 80));
      }
      if (!settled) finish(false);
    })();
  });
}

function createAuthClient(isSubsStore: boolean): SupabaseClient<Database> {
  return isSubsStore ? createSubsBrowserClient() : createClient();
}

function detectSubsFromWindow(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  const hashParams = parseHashParams(window.location.hash);
  const rawReturnUrl = url.searchParams.get("returnUrl") ?? "";
  return (
    detectAuthSiteFromStrings(
      url.searchParams.get("site") ?? hashParams.site ?? "",
      rawReturnUrl,
      readBrowserCookie("auth_reset_site") || readBrowserCookie("current_site"),
    ) === "subs-store"
  );
}

export function CallbackClient() {
  const router = useRouter();
  const [status, setStatus] = useState("Завершаем авторизацию…");
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [isSubsStore, setIsSubsStore] = useState(detectSubsFromWindow);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const url = new URL(window.location.href);
      const hashParams = parseHashParams(window.location.hash);
      const code = url.searchParams.get("code");
      const token_hash = url.searchParams.get("token_hash");
      const typeParam = url.searchParams.get("type") ?? hashParams.type ?? "";
      const oauthErr = url.searchParams.get("error");
      const errCode = url.searchParams.get("error_code");
      const errDesc = (url.searchParams.get("error_description") ?? "").replace(/\+/g, " ");
      const defaultReturnUrl = typeParam === "recovery" ? "/spotify" : "/cabinet";
      const rawReturnUrl = url.searchParams.get("returnUrl") ?? defaultReturnUrl;
      const returnUrl =
        rawReturnUrl.startsWith("/") && !rawReturnUrl.startsWith("//") ? rawReturnUrl : "/cabinet";

      const subsContext =
        detectAuthSiteFromStrings(
          url.searchParams.get("site") ?? hashParams.site ?? "",
          returnUrl,
          readBrowserCookie("auth_reset_site") || readBrowserCookie("current_site"),
        ) === "subs-store";

      setIsSubsStore(subsContext);

      const siteQs = subsContext ? "&site=subs-store" : "";

      function recoveryErr(kind: "expired" | "callback", detail?: string) {
        if (detail) {
          setFatalError(detail);
          setStatus("Не удалось подтвердить сброс пароля");
          return;
        }
        router.replace(`/reset-password?error=${kind}${siteQs ? siteQs.replace("&", "?") : ""}`);
      }

      function verifyErr(kind: "expired" | "used" | "callback") {
        router.replace(`/verify-email?error=${kind}${siteQs ? siteQs.replace("&", "?") : ""}`);
      }

      /** PKCE / token_hash — только серверный /auth/callback (правильный Supabase-проект + cookies). */
      if (code || token_hash) {
        setStatus("Перенаправляем на сервер авторизации…");
        const target = `/auth/callback${url.search}`;
        window.location.replace(target);
        return;
      }

      let supabase: SupabaseClient<Database>;
      try {
        supabase = createAuthClient(subsContext);
      } catch {
        router.replace(
          subsContext
            ? "/login?site=subs-store&error=config"
            : "/login?error=config",
        );
        return;
      }

      if (subsContext) {
        try {
          await createClient().auth.signOut({ scope: "local" });
        } catch {
          /* ignore */
        }
      }

      if (typeParam === "recovery") {
        setStatus("Подтверждаем сброс пароля…");

        if (oauthErr || errCode) {
          const blob = `${errCode ?? ""} ${errDesc} ${oauthErr ?? ""}`.toLowerCase();
          if (
            blob.includes("expired") ||
            errCode === "otp_expired" ||
            errCode === "flow_state_expired"
          ) {
            recoveryErr("expired");
            return;
          }
          recoveryErr("callback");
          return;
        }

        try {
          const {
            data: { session: existing },
          } = await supabase.auth.getSession();

          const hashHasTokens = Boolean(
            hashParams.access_token && hashParams.refresh_token,
          );

          if (!existing) {
            if (!hashHasTokens && !window.location.hash) {
              recoveryErr(
                "callback",
                "Ссылка открылась без токена сброса. Откройте письмо снова целиком (не копируйте URL вручную) или запросите новую ссылку. В Supabase → Authentication → URL Configuration добавьте http://127.0.0.1:3055/auth/callback и http://localhost:3055/callback",
              );
              return;
            }
            const fromHash = await tryApplySessionFromUrlHash(supabase);
            if (!fromHash) {
              const ok = await waitForImplicitSession(supabase);
              if (!ok) {
                recoveryErr(
                  "callback",
                  hashHasTokens
                    ? "Не удалось создать сессию сброса. Запросите новую ссылку на /reset-password?site=subs-store"
                    : undefined,
                );
                return;
              }
            } else {
              stripUrlHash();
            }
          }

          if (cancelled) return;

          const updateUrl = new URL("/reset-password/update", window.location.origin);
          updateUrl.searchParams.set("returnUrl", returnUrl);
          if (subsContext) updateUrl.searchParams.set("site", "subs-store");
          router.replace(`${updateUrl.pathname}?${updateUrl.searchParams.toString()}`);
          return;
        } catch {
          recoveryErr("callback");
          return;
        }
      }

      if (oauthErr || errCode) {
        const blob = `${errCode ?? ""} ${errDesc} ${oauthErr ?? ""}`.toLowerCase();
        if (
          blob.includes("expired") ||
          errCode === "otp_expired" ||
          errCode === "flow_state_expired"
        ) {
          verifyErr("expired");
          return;
        }
        if (blob.includes("already")) {
          verifyErr("used");
          return;
        }
        verifyErr("callback");
        return;
      }

      setStatus("Завершаем вход…");

      try {
        const hashAccess = hashParams.access_token;
        const hashRefresh = hashParams.refresh_token;
        const hashHasTokens = Boolean(hashAccess && hashRefresh);
        const isSignupConfirm =
          typeParam === "signup" || typeParam === "email" || typeParam === "invite";

        if (hashHasTokens) {
          // Не оставляем старую сессию (другой email): токены из письма всегда важнее.
          await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
          try {
            await createClient().auth.signOut({ scope: "local" });
          } catch {
            /* ignore */
          }
          const applied = await tryApplySessionFromUrlHash(supabase);
          if (!applied) {
            verifyErr("callback");
            return;
          }
          stripUrlHash();
        } else {
          const {
            data: { session: existing },
          } = await supabase.auth.getSession();

          if (isSignupConfirm && existing) {
            await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
            verifyErr("callback");
            return;
          }

          if (!existing) {
            const ok = await waitForImplicitSession(supabase);
            if (!ok) {
              const loginQs = new URLSearchParams({
                error: "callback",
                returnUrl,
              });
              if (subsContext) loginQs.set("site", "subs-store");
              router.replace(`/login?${loginQs.toString()}`);
              return;
            }
          }
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          const loginQs = new URLSearchParams({
            error: "callback",
            returnUrl,
          });
          if (subsContext) loginQs.set("site", "subs-store");
          router.replace(`/login?${loginQs.toString()}`);
          return;
        }

        const effectiveReturnUrl =
          subsContext && (returnUrl === "/cabinet" || returnUrl === "/dashboard")
            ? "/spotify"
            : returnUrl;

        const syncRes = await fetch("/api/auth/post-auth-sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-auth-site": subsContext ? "subs-store" : "gpt-store",
          },
          body: JSON.stringify({ returnUrl: effectiveReturnUrl }),
        });

        if (!syncRes.ok) {
          const loginQs = new URLSearchParams({
            error: "sync",
            returnUrl: effectiveReturnUrl,
          });
          if (subsContext) loginQs.set("site", "subs-store");
          router.replace(`/login?${loginQs.toString()}`);
          return;
        }

        const json = (await syncRes.json()) as { path?: string };
        if (typeof json.path === "string" && json.path.startsWith("/")) {
          router.replace(json.path);
          return;
        }

        router.replace(effectiveReturnUrl);
      } catch {
        verifyErr("callback");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="w-full">
      <h1
        className={`mb-2 font-heading text-xl font-bold ${isSubsStore ? "text-white" : "text-gray-900"}`}
      >
        Подождите
      </h1>
      <div className="flex min-h-[160px] flex-col items-center justify-center gap-4 px-2 text-center">
      <Loader2
        size={28}
        className="animate-spin"
        style={{ color: isSubsStore ? SUBS_GREEN : "#10a37f" }}
      />
      <p className={`text-sm ${isSubsStore ? "text-gray-300" : "text-gray-600"}`}>{status}</p>
      {fatalError && (
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            isSubsStore
              ? "border-red-700/40 bg-red-950/50 text-red-300"
              : "border-red-200 bg-red-50 text-red-700",
          )}
        >
          {fatalError}
        </p>
      )}
      <p className={`text-xs ${isSubsStore ? "text-gray-500" : "text-gray-400"}`}>
        {isSubsStore ? "Subs Store" : "GPT STORE"} · если экран не меняется больше 15 сек,{" "}
        <a
          href={isSubsStore ? "/reset-password?site=subs-store" : "/reset-password"}
          className="underline"
          style={{ color: isSubsStore ? SUBS_GREEN : "#10a37f" }}
        >
          запросите ссылку снова
        </a>
      </p>
      </div>
    </div>
  );
}
