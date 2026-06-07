import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

import { logAuthEmailAttempt } from "@/lib/auth/auth-email-log";
import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";
import { getEmailConfirmationState } from "@/lib/auth/get-auth-user-by-email";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmail";
import { sendTransactionalEmail } from "@/lib/email/send-email";
import { getPublicBrandName } from "@/lib/sites";
import { buildSignupRedirectTo } from "@/lib/site-url";
import { tryCreateAdminClient } from "@/lib/supabase/server";
import {
  getSubsPublicSupabaseAnonKey,
  getSubsPublicSupabaseUrl,
} from "@/lib/supabase/subs-auth-env";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

export type SendSignupConfirmationResult = {
  ok: boolean;
  channel?: string;
  error?: string;
  retryAfter?: number;
  alreadyConfirmed?: boolean;
  deliveryPending?: boolean;
};

export type SendSignupConfirmationTrigger = "post_signup" | "manual_resend";

function parseRateLimitSeconds(message: string): number | null {
  const m = message.match(/after\s+(\d+)\s+seconds?/i);
  if (m) return Number(m[1]);
  return null;
}

export function humanizeSignupEmailError(message: string): string {
  const lower = message.toLowerCase();
  const sec = parseRateLimitSeconds(message);
  if (sec != null) {
    return `Слишком частые запросы. Повторите через ${sec} сек.`;
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Слишком частые запросы. Подождите минуту и попробуйте снова.";
  }
  if (lower.includes("error sending") || lower.includes("smtp")) {
    return "Почтовый сервис временно недоступен. Попробуйте «Отправить повторно» через минуту.";
  }
  if (lower.includes("not configured") || lower.includes("provider")) {
    return "Письмо не удалось отправить с сервера. Попробуйте «Отправить повторно» или напишите в поддержку.";
  }
  return message;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildSignupEmailHtml(confirmLink: string, siteSlug: AuthSiteSlug): string {
  const isSubsStore = siteSlug === "subs-store";
  const brandName = getPublicBrandName(siteSlug);
  const accentColor = isSubsStore ? "#1DB954" : "#10a37f";
  const bgColor = isSubsStore ? "#111111" : "#ffffff";
  const headingColor = isSubsStore ? "#ffffff" : "#111827";
  const textColor = isSubsStore ? "#9ca3af" : "#6b7280";

  return `
    <div style="margin:0;padding:24px;background:${isSubsStore ? "#080808" : "#f3f4f6"};font-family:Arial,sans-serif;color:${headingColor}">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center">
            <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;background:${bgColor};border-radius:14px;padding:28px 24px">
              <tr>
                <td align="center" style="padding-bottom:10px;font-size:22px;font-weight:800;letter-spacing:.3px;color:${accentColor}">
                  ${brandName}
                </td>
              </tr>
              <tr>
                <td align="center" style="font-size:32px;line-height:1.2;font-weight:800;color:${headingColor};padding:6px 0 16px">
                  Подтвердите email
                </td>
              </tr>
              <tr>
                <td align="center" style="font-size:14px;line-height:1.6;color:${textColor};padding-bottom:18px">
                  Нажмите кнопку ниже, чтобы завершить регистрацию и продолжить оформление заказа.
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:6px 0 18px">
                  <a href="${confirmLink}" style="display:inline-block;background:${accentColor};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:700;">
                    Подтвердить email
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center" style="font-size:12px;line-height:1.6;color:${textColor};padding-bottom:8px">
                  Если кнопка не открывается, скопируйте ссылку в браузер:<br />
                  <a href="${confirmLink}" style="color:${accentColor};text-decoration:underline;word-break:break-all">${confirmLink}</a>
                </td>
              </tr>
              <tr>
                <td align="center" style="font-size:12px;line-height:1.6;color:${textColor};padding-top:6px">
                  Если вы не регистрировались на ${brandName} — проигнорируйте это письмо. Проверьте папку «Спам», если письма нет во «Входящих».
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

async function buildSignupLinkFromAdmin(
  email: string,
  siteSlug: AuthSiteSlug,
  appBaseUrl: string,
  returnUrl: string,
): Promise<{ link: string; error?: string }> {
  const admin = siteSlug === "subs-store" ? createSubsStoreAdminClient() : tryCreateAdminClient();
  if (!admin) {
    return { link: "", error: "Auth admin не настроен на сервере" };
  }

  const redirectTo = buildSignupRedirectTo(siteSlug, returnUrl, appBaseUrl);
  const safeReturn =
    returnUrl.startsWith("/") && !returnUrl.startsWith("//") ? returnUrl : "/cabinet";

  const linkTypes = ["invite", "magiclink"] as const;
  let lastError = "";

  for (const linkType of linkTypes) {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: linkType,
      email,
      options: { redirectTo },
    });

    if (linkError) {
      lastError = linkError.message;
      continue;
    }

    const actionLink = linkData?.properties?.action_link ?? "";
    const hashedToken = linkData?.properties?.hashed_token ?? "";
    const callbackLink = hashedToken
      ? `${appBaseUrl}/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=signup&site=${siteSlug}&returnUrl=${encodeURIComponent(safeReturn)}`
      : "";

    const link = callbackLink || actionLink;
    if (link) return { link };
  }

  return { link: "", error: lastError || "Не удалось создать ссылку подтверждения" };
}

async function sendViaSupabaseResend(
  email: string,
  siteSlug: AuthSiteSlug,
  appBaseUrl: string,
  returnUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const redirectTo = buildSignupRedirectTo(siteSlug, returnUrl, appBaseUrl);

  if (siteSlug === "subs-store") {
    const url = getSubsPublicSupabaseUrl();
    const key = getSubsPublicSupabaseAnonKey();
    if (!url || !key) {
      return { ok: false, error: "Subs Supabase не настроен" };
    }
    const client = createSupabaseJsClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await client.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: redirectTo },
    });
    return { ok: !error, error: error?.message };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    return { ok: false, error: "Supabase не настроен" };
  }
  const client = createSupabaseJsClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: redirectTo },
  });
  return { ok: !error, error: error?.message };
}

export async function sendSignupConfirmationEmail(args: {
  email: string;
  siteSlug: AuthSiteSlug;
  returnUrl: string;
  appBaseUrl: string;
  trigger?: SendSignupConfirmationTrigger;
}): Promise<SendSignupConfirmationResult> {
  const email = normalizeEmailForAuth(args.email);
  const trigger = args.trigger ?? "manual_resend";
  const siteSlug = args.siteSlug === "subs-store" ? "subs-store" : "gpt-store";

  if (!email || !isValidEmail(email)) {
    return { ok: false, error: "Укажите корректный email" };
  }

  const returnUrl =
    args.returnUrl.startsWith("/") && !args.returnUrl.startsWith("//")
      ? args.returnUrl
      : "/checkout";

  const state = await getEmailConfirmationState(email, siteSlug);
  if (state.emailConfirmed) {
    return { ok: true, alreadyConfirmed: true, channel: "already_confirmed" };
  }
  if (!state.exists) {
    return { ok: false, error: "Аккаунт с этим email не найден. Зарегистрируйтесь снова." };
  }

  const { link, error: linkError } = await buildSignupLinkFromAdmin(
    email,
    siteSlug,
    args.appBaseUrl,
    returnUrl,
  );

  if (link) {
    const subject = `Подтвердите email — ${getPublicBrandName(siteSlug)}`;
    const text = `Подтвердите регистрацию: ${link}`;
    const html = buildSignupEmailHtml(link, siteSlug);
    const custom = await sendTransactionalEmail(email, subject, text, html, { siteSlug });
    if (custom.ok) {
      logAuthEmailAttempt({
        event: trigger === "post_signup" ? "signup_send" : "resend_confirmation",
        email,
        siteSlug,
        ok: true,
        channel: custom.provider,
        trigger,
      });
      return { ok: true, channel: custom.provider };
    }
  }

  const fallback = await sendViaSupabaseResend(email, siteSlug, args.appBaseUrl, returnUrl);
  if (fallback.ok) {
    logAuthEmailAttempt({
      event: trigger === "post_signup" ? "signup_send" : "resend_confirmation",
      email,
      siteSlug,
      ok: true,
      channel: "supabase_resend",
      trigger,
    });
    return { ok: true, channel: "supabase_resend" };
  }

  const rawMsg = linkError ?? fallback.error ?? "Не удалось отправить письмо";
  const retryAfter = parseRateLimitSeconds(rawMsg) ?? undefined;

  logAuthEmailAttempt({
    event: trigger === "post_signup" ? "signup_send" : "resend_confirmation",
    email,
    siteSlug,
    ok: false,
    error: rawMsg,
    trigger,
  });

  return {
    ok: false,
    deliveryPending: trigger === "post_signup",
    error: humanizeSignupEmailError(rawMsg),
    retryAfter,
  };
}
