"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { User } from "lucide-react";

import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { getCheckoutSessionUser } from "@/lib/checkout/checkout-auth";
import { createClient } from "@/lib/supabase/client";
import { tryCreateSubsBrowserClient } from "@/lib/supabase/subs-browser-client";

type LandingAuthNavLinkProps = {
  siteSlug: SiteSlug;
  className?: string;
  style?: React.CSSProperties;
  onMouseEnter?: React.MouseEventHandler<HTMLAnchorElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLAnchorElement>;
};

function buildLoginHref(siteSlug: SiteSlug, returnPath: string): string {
  const params = new URLSearchParams({
    site: siteSlug,
    returnUrl: returnPath,
  });
  return `/login?${params.toString()}`;
}

function cabinetHrefFor(siteSlug: SiteSlug): string {
  return siteSlug === "subs-store"
    ? "/dashboard?site=subs-store"
    : "/dashboard?site=gpt-store";
}

export function LandingAuthNavLink({
  siteSlug,
  className,
  style,
  onMouseEnter,
  onMouseLeave,
}: LandingAuthNavLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [hasAccount, setHasAccount] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  const isSubs = siteSlug === "subs-store";
  const returnPath =
    pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
  const cabinetHref = cabinetHrefFor(siteSlug);
  const loginHref = buildLoginHref(siteSlug, returnPath || (isSubs ? "/spotify" : "/"));

  const refreshSession = useCallback(async () => {
    const { user } = await getCheckoutSessionUser(siteSlug);
    setHasAccount(Boolean(user));
    setSessionChecked(true);
  }, [siteSlug]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      await refreshSession();
      if (cancelled) return;

      const client = isSubs ? tryCreateSubsBrowserClient() : createClient();
      if (!client) return;

      const { data } = client.auth.onAuthStateChange(() => {
        void refreshSession();
      });
      unsubscribe = () => data.subscription.unsubscribe();
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isSubs, refreshSession]);

  const label = hasAccount && sessionChecked ? "Кабинет" : "Войти";
  const href = hasAccount && sessionChecked ? cabinetHref : loginHref;

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    event.stopPropagation();

    void (async () => {
      const { user, emailConfirmed } = await getCheckoutSessionUser(siteSlug);
      if (user) {
        setHasAccount(true);
        if (!emailConfirmed && user.email) {
          const verify = new URLSearchParams({
            email: user.email,
            flow: "checkout",
            site: siteSlug,
            returnUrl: cabinetHref,
          });
          router.push(`/verify-email?${verify.toString()}`);
          return;
        }
        router.push(cabinetHref);
        return;
      }
      setHasAccount(false);
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

/** Статичный fallback для Suspense — всегда кликабельный «Войти». */
export function LandingAuthNavLinkFallback({
  siteSlug,
  className,
  style,
  onMouseEnter,
  onMouseLeave,
}: LandingAuthNavLinkProps) {
  const loginHref = buildLoginHref(siteSlug, siteSlug === "subs-store" ? "/spotify" : "/");
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
