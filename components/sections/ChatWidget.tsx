"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { tryCreateSubsBrowserClient } from "@/lib/supabase/subs-browser-client";
import { ChatWindow } from "@/components/chat/ChatWindow";
import type { Profile } from "@/types";
import type { ClientChatSessionPayload } from "@/types/chat-ui";
import { cn } from "@/lib/utils";
import { useSafePathname } from "@/lib/client/useSafePathname";

interface ChatWidgetProps {
  /** Site context for this widget. Defaults to "gpt-store". */
  siteSlug?: "subs-store" | "gpt-store";
}

export function ChatWidget({ siteSlug = "gpt-store" }: ChatWidgetProps) {
  const pathname = useSafePathname();
  const isSubsStore = siteSlug === "subs-store";
  const accentColor = isSubsStore ? "#1DB954" : "#10a37f";
  const accentHover = isSubsStore ? "#17a349" : "#0d8f68";
  const chatPartyName = isSubsStore ? "SPOTIFY STORE — поддержка" : "GPT STORE — поддержка";
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<Profile | null>(null);
  const [session, setSession] = useState<ClientChatSessionPayload | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [openSessionLoading, setOpenSessionLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const gptSupabase = useMemo(() => createClient(), []);
  const subsSupabase = useMemo(() => (isSubsStore ? tryCreateSubsBrowserClient() : null), [isSubsStore]);

  const fetchClientSession = useCallback(async () => {
    if (isSubsStore) {
      const r = await fetch("/api/subs/chat/rooms", { credentials: "include" });
      const j = (await r.json().catch(() => ({}))) as ClientChatSessionPayload & { error?: string; code?: string };
      if (!r.ok) {
        throw new Error(j.error ?? `Не удалось открыть чат Spotify Store (${r.status})`);
      }
      if (j?.id) setSession(j);
      else throw new Error("Пустой ответ сервера (Subs chat)");
      return;
    }
    const r = await fetch("/api/chat/rooms", { credentials: "include" });
    if (!r.ok) throw new Error("Не удалось получить чат");
    const d = (await r.json()) as ClientChatSessionPayload;
    if (d?.id) setSession(d);
    else throw new Error("Пустой ответ сервера");
  }, [isSubsStore]);

  const fetchUnread = useCallback(async () => {
    if (isSubsStore) {
      const u = await fetch("/api/subs/chat/unread", { credentials: "include" });
      const uj = (await u.json()) as { unread?: number };
      setUnread(uj.unread ?? 0);
      return;
    }
    const u = await fetch("/api/chat/unread", { credentials: "include" });
    const uj = (await u.json()) as { unread?: number };
    setUnread(uj.unread ?? 0);
  }, [isSubsStore]);

  useEffect(() => {
    const loadUser = async () => {
      if (isSubsStore && subsSupabase) {
        const { data: { session: authSession } } = await subsSupabase.auth.getSession();
        const authUser = authSession?.user ?? null;
        if (!authUser) {
          setLoading(false);
          return;
        }
        const profile: Profile = {
          id: authUser.id,
          email: authUser.email ?? null,
          username: authUser.user_metadata?.username ?? authUser.email?.split("@")[0] ?? null,
          telegram_id: null,
          telegram_username: null,
          role: "client",
          created_at: authUser.created_at ?? new Date().toISOString(),
          last_seen: null,
        };
        setUser(profile);
        setLoading(false);
        return;
      }
      if (isSubsStore) {
        setLoading(false);
        return;
      }
      const { data: { session: authSession } } = await gptSupabase.auth.getSession();
      const authUser = authSession?.user ?? null;
      if (!authUser) {
        setLoading(false);
        return;
      }
      const { data: profile } = await gptSupabase
        .from("profiles")
        .select("id, email, username, telegram_id, telegram_username, role, created_at, last_seen")
        .eq("id", authUser.id)
        .single();
      setUser(profile as Profile);
      setLoading(false);
    };
    const deferTimer = window.setTimeout(() => {
      void loadUser();
    }, 4_000);
    return () => window.clearTimeout(deferTimer);
  }, [gptSupabase, isSubsStore, subsSupabase]);

  useEffect(() => {
    if (!user) return;
    if (user.role === "admin" || user.role === "operator") return;

    void (async () => {
      try {
        await fetchClientSession();
      } catch {
        setSession(null);
      }
      await fetchUnread();
    })();
  }, [user, fetchClientSession, fetchUnread]);

  useEffect(() => {
    if (isSubsStore) return;
    if (!user || user.role === "admin" || user.role === "operator") return;
    if (!session?.id) return;

    const ch = gptSupabase
      .channel(`widget-unread:${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          const row = payload.new as { sender_type?: string };
          if (row.sender_type === "operator" || row.sender_type === "admin") {
            if (!open) setUnread((n) => n + 1);
          }
        },
      )
      .subscribe();

    return () => {
      void gptSupabase.removeChannel(ch);
    };
  }, [user, session?.id, gptSupabase, open, isSubsStore]);

  useEffect(() => {
    if (!isSubsStore || !user || open) return;
    const t = window.setInterval(() => {
      void fetchUnread();
    }, 5000);
    return () => window.clearInterval(t);
  }, [isSubsStore, user, open, fetchUnread]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  useEffect(() => {
    if (!open || !user) return;
    if (user.role === "admin" || user.role === "operator") return;
    if (session?.id) return;

    let cancelled = false;
    setOpenSessionLoading(true);
    setSessionError(null);
    void fetchClientSession()
      .catch((e) => {
        if (!cancelled) setSessionError(e instanceof Error ? e.message : "Ошибка");
      })
      .finally(() => {
        if (!cancelled) setOpenSessionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, user, session?.id, fetchClientSession]);

  const chatDashboardHref = isSubsStore
    ? "/dashboard/chat?site=subs-store"
    : "/dashboard/chat";
  const subsAuthHref = `/register?site=subs-store&returnUrl=${encodeURIComponent("/dashboard/chat?site=subs-store")}`;
  const loginHref = isSubsStore
    ? subsAuthHref
    : `/login?returnUrl=${encodeURIComponent("/dashboard/chat")}`;
  const subsLandingSupportLink =
    isSubsStore && (pathname === "/spotify" || pathname === "/support");
  /** На лендингах mobile: компактная кнопка чата, чтобы не перекрывать sticky CTA. */
  const landingCompactChat =
    pathname === "/" || pathname === "/spotify" || subsLandingSupportLink;

  const chatIconSvg = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );

  const landingChatDockClass = cn(
    "fixed z-50 pb-[env(safe-area-inset-bottom)]",
    landingCompactChat
      ? "bottom-3 right-3 max-md:bottom-[max(0.65rem,env(safe-area-inset-bottom))] max-md:right-3 md:bottom-6 md:right-6"
      : "bottom-4 right-4 sm:bottom-6 sm:right-6",
  );

  const landingChatButtonClass = cn(
    "flex items-center gap-2 rounded-full text-sm font-medium text-white shadow-lg transition-all duration-200",
    landingCompactChat
      ? "max-md:h-12 max-md:w-12 max-md:justify-center max-md:p-0 md:px-4 md:py-3"
      : "px-3 py-2.5 sm:px-4 sm:py-3",
  );

  const landingChatLabel = (
    <span className={cn(landingCompactChat && "hidden md:inline")}>Чат поддержки</span>
  );

  if (pathname === "/support" && !isSubsStore) return null;
  if (loading) return null;

  if (subsLandingSupportLink) {
    const landingSupportHref =
      user?.role === "admin"
        ? "/admin/chat?site=subs-store"
        : user?.role === "operator"
          ? "/operator/chat?site=subs-store"
          : user
            ? chatDashboardHref
            : loginHref;

    return (
      <div className={landingChatDockClass}>
        <a
          href={landingSupportHref}
          className={landingChatButtonClass}
          aria-label="Чат поддержки"
          style={{
            backgroundColor: accentColor,
            boxShadow: `0 4px 14px ${accentColor}40`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = accentHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = accentColor;
          }}
        >
          {chatIconSvg}
          {landingChatLabel}
        </a>
      </div>
    );
  }

  if (pathname === "/" && user && user.role !== "admin" && user.role !== "operator") {
    return (
      <div className={cn(landingChatDockClass, "flex flex-col items-end gap-2")}>
        <div
          className={cn(
            "overflow-hidden rounded-2xl shadow-2xl transition-all duration-300",
            "border border-gray-200 bg-white",
            open
              ? "h-[min(560px,calc(100dvh-6rem))] w-[min(380px,calc(100vw-2rem))] translate-y-0 opacity-100"
              : "pointer-events-none h-0 w-0 translate-y-4 opacity-0",
          )}
        >
          {open && session && (
            <div className="h-full w-full">
              <ChatWindow
                currentUser={user}
                sessionId={session.id}
                roomStatus={session.status === "closed" ? "closed" : "open"}
                otherPartyName={chatPartyName}
                viewerIsStaff={false}
                siteSlug={siteSlug}
              />
            </div>
          )}
          {open && !session?.id && (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm">
              <p className="text-gray-600">
                {openSessionLoading ? "Подключаем чат…" : sessionError ?? ""}
              </p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn("relative", landingChatButtonClass)}
          style={{
            backgroundColor: accentColor,
            boxShadow: `0 4px 14px ${accentColor}40`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = accentHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = accentColor;
          }}
          aria-label={open ? "Закрыть чат" : "Открыть чат поддержки"}
        >
          {chatIconSvg}
          {landingChatLabel}
          {unread > 0 && !open && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
              {Math.min(unread, 9)}
            </span>
          )}
        </button>
      </div>
    );
  }

  if (pathname === "/") {
    const landingSupportHref = user ? chatDashboardHref : loginHref;
    return (
      <div className={landingChatDockClass}>
        <a
          href={landingSupportHref}
          className={landingChatButtonClass}
          aria-label="Чат поддержки"
          style={{
            backgroundColor: accentColor,
            boxShadow: `0 4px 14px ${accentColor}40`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = accentHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = accentColor;
          }}
        >
          {chatIconSvg}
          {landingChatLabel}
        </a>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
        <a
          href={loginHref}
          className="flex items-center gap-2 rounded-full px-3 py-2.5 text-sm font-medium text-white shadow-lg transition-all duration-200 sm:px-4 sm:py-3"
          style={{
            backgroundColor: accentColor,
            boxShadow: `0 4px 14px ${accentColor}40`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = accentHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = accentColor;
          }}
        >
          {chatIconSvg}
          Чат поддержки
        </a>
      </div>
    );
  }

  if (user.role === "admin" || user.role === "operator") {
    const staffChatHref =
      isSubsStore ? "/operator/chat?site=subs-store" : user.role === "admin" ? "/admin/chat" : "/operator/chat";
    return (
      <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
        <a
          href={staffChatHref}
          className="flex items-center gap-2 rounded-full border border-white/20 bg-gray-900 px-3 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-gray-800 sm:px-4 sm:py-3"
        >
          Панель чата
        </a>
      </div>
    );
  }

  if (pathname === "/support") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
      <div
        className={cn(
          "overflow-hidden rounded-2xl shadow-2xl transition-all duration-300",
          isSubsStore ? "border border-white/10 bg-[#111111]" : "border border-gray-200 bg-white",
          open
            ? "h-[min(560px,calc(100dvh-6rem))] w-[min(380px,calc(100vw-2rem))] translate-y-0 opacity-100"
            : "pointer-events-none h-0 w-0 translate-y-4 opacity-0",
        )}
      >
        {open && session && user && (
          <div className="h-full w-full">
            <ChatWindow
              currentUser={user}
              sessionId={session.id}
              roomStatus={session.status === "closed" ? "closed" : "open"}
              otherPartyName={chatPartyName}
              viewerIsStaff={false}
              siteSlug={siteSlug}
            />
          </div>
        )}
        {open && !session?.id && user && (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm">
            <p className={isSubsStore ? "text-gray-400" : "text-gray-600"}>
              {openSessionLoading ? "Подключаем чат…" : ""}
            </p>
            {!openSessionLoading && sessionError && (
              <>
                <p className="text-red-500">{sessionError}</p>
                <button
                  type="button"
                  className="underline"
                  style={{ color: accentColor }}
                  onClick={() => {
                    setSessionError(null);
                    setOpenSessionLoading(true);
                    void fetchClientSession()
                      .catch((e) => setSessionError(e instanceof Error ? e.message : "Ошибка"))
                      .finally(() => setOpenSessionLoading(false));
                  }}
                >
                  Повторить
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-all"
        style={{
          backgroundColor: accentColor,
          boxShadow: `0 4px 14px ${accentColor}40`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = accentHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = accentColor;
        }}
        aria-label={open ? "Закрыть чат" : "Открыть чат"}
      >
        {unread > 0 && !open && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {Math.min(unread, 9)}
          </span>
        )}
        {open ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
