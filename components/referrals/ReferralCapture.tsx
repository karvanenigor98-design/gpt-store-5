"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const COOKIE_NAME = "gs_referral_code";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function setRefCookie(code: string) {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(code)}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

function readRefCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** Сохраняет ?ref= из URL и привязывает после входа в кабинет. */
export function ReferralCapture({ siteSlug }: { siteSlug?: "gpt-store" | "subs-store" }) {
  const sp = useSearchParams();

  useEffect(() => {
    const fromUrl = sp.get("ref")?.trim();
    if (fromUrl) setRefCookie(fromUrl.toUpperCase());
  }, [sp]);

  useEffect(() => {
    const code = readRefCookie();
    if (!code) return;

    const site =
      siteSlug ??
      (typeof window !== "undefined" && window.location.pathname.startsWith("/spotify")
        ? "subs-store"
        : "gpt-store");

    void fetch("/api/referral/attach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ code, site }),
    })
      .then((res) => {
        if (res.ok) document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
      })
      .catch(() => undefined);
  }, [siteSlug]);

  return null;
}
