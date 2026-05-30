import crypto from "crypto";

import type { NextResponse } from "next/server";

import type { SiteSlug } from "@/lib/auth/siteUiSession";

export const CHECKOUT_RETURN_COOKIE = "pally_checkout_return";
const MAX_AGE_SEC = 60 * 60 * 2;

function signingSecret(): string {
  return (
    process.env.PALLY_SECRET_KEY?.trim() ||
    process.env.CHECKOUT_RETURN_SECRET?.trim() ||
    "dev-checkout-return"
  );
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", signingSecret()).update(payload).digest("hex").slice(0, 32);
}

export function buildCheckoutReturnCookieValue(siteSlug: SiteSlug, orderId: string): string {
  const payload = `${siteSlug}:${orderId}`;
  return `${payload}.${sign(payload)}`;
}

export function parseCheckoutReturnCookieValue(
  raw: string | undefined,
): { siteSlug: SiteSlug; orderId: string } | null {
  if (!raw?.trim()) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!payload || !sig || sign(payload) !== sig) return null;

  const colon = payload.indexOf(":");
  if (colon <= 0) return null;
  const site = payload.slice(0, colon);
  const orderId = payload.slice(colon + 1);
  if ((site !== "gpt-store" && site !== "subs-store") || !orderId.trim()) return null;
  return { siteSlug: site as SiteSlug, orderId: orderId.trim() };
}

export function checkoutReturnCookieOptions(value: string) {
  return {
    name: CHECKOUT_RETURN_COOKIE,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: MAX_AGE_SEC,
    path: "/",
  };
}

export function appendCheckoutReturnCookie(
  response: NextResponse,
  siteSlug: SiteSlug,
  orderId: string,
): NextResponse {
  response.cookies.set(
    checkoutReturnCookieOptions(buildCheckoutReturnCookieValue(siteSlug, orderId)),
  );
  return response;
}

export function clearCheckoutReturnCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: CHECKOUT_RETURN_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
