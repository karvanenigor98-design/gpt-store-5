import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmail";

export type AuthEmailEvent =
  | "signup_send"
  | "resend_confirmation"
  | "password_recovery";

export type AuthEmailLogPayload = {
  event: AuthEmailEvent;
  email: string;
  siteSlug: AuthSiteSlug;
  ok: boolean;
  channel?: string;
  error?: string;
  trigger?: "post_signup" | "manual_resend";
};

/** Server-side auth email diagnostics — без токенов и секретов. */
export function logAuthEmailAttempt(payload: AuthEmailLogPayload): void {
  const email = normalizeEmailForAuth(payload.email);
  const line = {
    ts: new Date().toISOString(),
    event: payload.event,
    email: email ? `${email.split("@")[0]?.slice(0, 3) ?? "?"}***@${email.split("@")[1] ?? "?"}` : "unknown",
    site: payload.siteSlug,
    ok: payload.ok,
    channel: payload.channel ?? null,
    trigger: payload.trigger ?? null,
    error: payload.error?.slice(0, 200) ?? null,
  };
  if (payload.ok) {
    console.info("[auth-email]", JSON.stringify(line));
  } else {
    console.warn("[auth-email]", JSON.stringify(line));
  }
}
