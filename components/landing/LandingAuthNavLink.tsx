"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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

function buildLoginHref(siteSlug: SiteSlug, returnPath: string): string {
  const params = new URLSearchParams({
    site: siteSlug,
    returnUrl: returnPath,
  });
  return `/login?${params.toString()}`;
}

export function LandingAuthNavLink({
  siteSlug,
  className,
  style,
  onMouseEnter,
  onMouseLeave,
}: LandingAuthNavLinkProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loggedIn, setLoggedIn] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  const isSubs = siteSlug === "subs-store";
  const returnPath =
    pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
  const cabinetHref = isSubs
    ? "/dashboard?site=subs-store"
    : "/dashboard?site=gpt-store";
  const loginHref = buildLoginHref(siteSlug, returnPath || (isSubs ? "/spotify" : "/"));

  useEffect(() => {
    let cancelled = false;
    void getCheckoutSessionUser(siteSlug).then(({ user, emailConfirmed }) => {
      if (cancelled) return;
      setLoggedIn(Boolean(user && emailConfirmed));
      setSessionChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [siteSlug]);

  const href = loggedIn && sessionChecked ? cabinetHref : loginHref;
  const label = loggedIn && sessionChecked ? "Кабинет" : "Войти";

  return (
    <Link
      href={href}
      prefetch={false}
      className={className}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => e.stopPropagation()}
    >
      <User size={14} />
      {label}
    </Link>
  );
}
