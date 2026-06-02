"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User } from "lucide-react";

import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { getCheckoutSessionUser } from "@/lib/checkout/checkout-auth";

type LandingAuthNavLinkProps = {
  siteSlug: SiteSlug;
  className?: string;
  style?: React.CSSProperties;
  onMouseEnter?: React.MouseEventHandler<HTMLAnchorElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLAnchorElement>;
};

export function LandingAuthNavLink({
  siteSlug,
  className,
  style,
  onMouseEnter,
  onMouseLeave,
}: LandingAuthNavLinkProps) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const isSubs = siteSlug === "subs-store";
  const cabinetHref = isSubs ? "/cabinet?site=subs-store" : "/cabinet?site=gpt-store";
  const loginHref = isSubs
    ? "/login?site=subs-store&returnUrl=%2Fspotify"
    : "/login?site=gpt-store&returnUrl=%2F";

  useEffect(() => {
    let cancelled = false;
    void getCheckoutSessionUser(siteSlug).then(({ user, emailConfirmed }) => {
      if (!cancelled) setLoggedIn(Boolean(user && emailConfirmed));
    });
    return () => {
      cancelled = true;
    };
  }, [siteSlug]);

  if (loggedIn === null) {
    return (
      <span
        className={className}
        style={{ ...style, visibility: "hidden" }}
        aria-hidden
      >
        <User size={14} />
        …
      </span>
    );
  }

  if (loggedIn) {
    return (
      <Link
        href={cabinetHref}
        className={className}
        style={style}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <User size={14} />
        Кабинет
      </Link>
    );
  }

  return (
    <Link
      href={loginHref}
      className={className}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <User size={14} />
      Войти
    </Link>
  );
}
