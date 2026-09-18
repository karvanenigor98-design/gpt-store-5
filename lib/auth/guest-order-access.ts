import crypto from "crypto";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";
import { createAdminClient } from "@/lib/supabase/server";
import { getGptPublicSupabaseUrl } from "@/lib/supabase/validate-project-url";
import type { Database } from "@/types/database";

export type GuestAccessNext = "chat" | "account";

function guestAccessSigningKey(): string {
  return (
    process.env.GUEST_ORDER_ACCESS_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
}

export function signGuestOrderAccess(orderId: string): string {
  const key = guestAccessSigningKey();
  if (!key) throw new Error("guest_access_secret_missing");
  return crypto.createHmac("sha256", key).update(`gpt-guest-order:${orderId}`).digest("hex");
}

export function verifyGuestOrderAccess(orderId: string, sig: string): boolean {
  const incoming = sig.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(incoming)) return false;
  try {
    const expected = signGuestOrderAccess(orderId);
    const a = Buffer.from(incoming, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function guestAccessRedirectPath(orderId: string, next: GuestAccessNext): string {
  const id = encodeURIComponent(orderId);
  if (next === "account") {
    return `/dashboard/orders?site=gpt-store&highlightOrder=${id}`;
  }
  return "/dashboard/chat?site=gpt-store";
}

export function buildGuestOrderAccessUrl(
  appBaseUrl: string,
  orderId: string,
  next: GuestAccessNext,
): string {
  const base = appBaseUrl.replace(/\/$/, "");
  const sig = signGuestOrderAccess(orderId);
  const params = new URLSearchParams({
    order: orderId,
    sig,
    next,
  });
  return `${base}/auth/guest-access?${params.toString()}`;
}

type PendingCookie = {
  name: string;
  value: string;
  options?: Parameters<import("next/server").NextResponse["cookies"]["set"]>[2];
};

/** Magic-link OTP only for this browser session. Does not go into the customer email. */
export async function establishGptMagicSession(email: string): Promise<
  | { ok: true; pending: PendingCookie[]; userId: string }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const hashedToken = linkData?.properties?.hashed_token ?? "";
  if (linkError || !hashedToken) {
    return { ok: false, error: linkError?.message ?? "Не удалось открыть сессию" };
  }

  const supabaseUrl = getGptPublicSupabaseUrl();
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!supabaseUrl || !supabaseAnon) {
    return { ok: false, error: "Auth env missing" };
  }

  const cookieStore = await cookies();
  const pending: PendingCookie[] = [];
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnon, {
    cookieOptions: getAuthCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const row of cookiesToSet) {
          pending.push(row);
          try {
            cookieStore.set(row.name, row.value, row.options);
          } catch {
            /* response cookies */
          }
        }
      },
    },
  });

  let verify = await supabase.auth.verifyOtp({
    token_hash: hashedToken,
    type: "magiclink",
  });
  if (verify.error) {
    verify = await supabase.auth.verifyOtp({
      token_hash: hashedToken,
      type: "email",
    });
  }
  if (verify.error) {
    return { ok: false, error: verify.error.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { ok: false, error: "Session user missing" };
  }

  return { ok: true, pending, userId: user.id };
}
