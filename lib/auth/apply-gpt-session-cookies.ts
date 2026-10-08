import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import { getAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";
import { getGptPublicSupabaseUrl } from "@/lib/supabase/validate-project-url";

const CHUNK = 3180;

function cookieName(): string {
  const host = new URL(getGptPublicSupabaseUrl()).hostname;
  const ref = host.split(".")[0] ?? "gpt";
  return `sb-${ref}-auth-token`;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function applyGptSessionCookies(
  res: NextResponse,
  session: {
    accessToken: string;
    refreshToken: string;
    user: User;
    expiresAt?: number;
  },
): void {
  const name = cookieName();
  const expiresAt = session.expiresAt ?? Math.floor(Date.now() / 1000) + 3600;
  const payload = JSON.stringify({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    token_type: "bearer",
    expires_in: Math.max(60, expiresAt - Math.floor(Date.now() / 1000)),
    expires_at: expiresAt,
    user: session.user,
  });
  const encoded = `base64-${toBase64Url(payload)}`;
  const opts = {
    ...getAuthCookieOptions(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    sameSite: "lax" as const,
  };

  for (let i = 0; i < 8; i += 1) {
    res.cookies.set(i === 0 ? name : `${name}.${i}`, "", { ...opts, maxAge: 0 });
  }

  if (encoded.length <= CHUNK) {
    res.cookies.set(name, encoded, opts);
    return;
  }

  let chunk = 0;
  for (let offset = 0; offset < encoded.length; offset += CHUNK) {
    res.cookies.set(`${name}.${chunk}`, encoded.slice(offset, offset + CHUNK), opts);
    chunk += 1;
  }
}
