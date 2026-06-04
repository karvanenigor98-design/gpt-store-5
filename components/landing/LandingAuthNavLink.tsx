"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";

import type { SiteSlug } from "@/lib/auth/siteUiSession";

type LandingAuthNavLinkProps = {
  siteSlug: SiteSlug;
  /** SSR: сессия с сервера (httpOnly cookies), без мигания «Войти». */
  initialLoggedIn?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onMouseEnter?: React.MouseEventHandler<HTMLAnchorElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLAnchorElement>;
};

export function cabinetHrefFor(siteSlug: SiteSlug): string {
  return siteSlug === "subs-store"
    ? "/dashboard?site=subs-store"
    : "/dashboard?site=gpt-store";
}

/** Логин с returnUrl в кабинет — middleware сам редиректит уже залогиненных. */
export function buildLandingAuthLoginHref(siteSlug: SiteSlug): string {
  const cabinet = cabinetHrefFor(siteSlug);
  const params = new URLSearchParams({
    site: siteSlug,
    returnUrl: cabinet,
  });
  return `/login?${params.toString()}`;
}

async function fetchLandingSession(siteSlug: SiteSlug): Promise<{
  loggedIn: boolean;
  emailConfirmed: boolean;
}> {
  try {
    const res = await fetch(`/api/auth/landing-session?site=${encodeURIComponent(siteSlug)}`, {
      credentials: "include",
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as {
      loggedIn?: boolean;
      emailConfirmed?: boolean;
    };
    if (!res.ok) return { loggedIn: false, emailConfirmed: false };
    return {
      loggedIn: Boolean(body.loggedIn),
      emailConfirmed: Boolean(body.emailConfirmed),
    };
  } catch {
    return { loggedIn: false, emailConfirmed: false };
  }
}

export function LandingAuthNavLink({
  siteSlug,
  initialLoggedIn = false,
  className,
  style,
  onMouseEnter,
  onMouseLeave,
}: LandingAuthNavLinkProps) {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(initialLoggedIn);
  const [sessionChecked, setSessionChecked] = useState(initialLoggedIn);

  const cabinetHref = cabinetHrefFor(siteSlug);
  const loginHref = buildLandingAuthLoginHref(siteSlug);

  const refreshSession = useCallback(async () => {
    const session = await fetchLandingSession(siteSlug);
    setLoggedIn(session.loggedIn);
    setSessionChecked(true);
    return session;
  }, [siteSlug]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const showCabinet = loggedIn && sessionChecked;
  const label = showCabinet ? "Кабинет" : "Войти";
  const href = showCabinet ? cabinetHref : loginHref;

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    event.stopPropagation();

    void (async () => {
      const session = await refreshSession();

      if (session.loggedIn) {
        if (!session.emailConfirmed) {
          router.push(loginHref);
          return;
        }
        router.push(cabinetHref);
        return;
      }

      router.push(loginHref);
    })();
  }

  return (
    <Link
      href={href}
      prefetch={false}
      className={className}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={handleClick}
    >
      <User size={14} />
      {label}
    </Link>
  );
}

/** Fallback без Suspense: href на login→middleware уводит в кабинет если сессия есть. */
export function LandingAuthNavLinkFallback({
  siteSlug,
  className,
  style,
  onMouseEnter,
  onMouseLeave,
}: LandingAuthNavLinkProps) {
  const loginHref = buildLandingAuthLoginHref(siteSlug);
  return (
    <Link
      href={loginHref}
      prefetch={false}
      className={className}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => e.stopPropagation()}
    >
      <User size={14} />
      Войти
    </Link>
  );
}
