import { NextRequest, NextResponse } from "next/server";

import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

import { hasSubsStoreAuthUserByEmail } from "@/lib/auth/subsMembershipByEmail";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  getSubsPublicSupabaseAnonKey,
  getSubsPublicSupabaseUrl,
} from "@/lib/supabase/subs-auth-env";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

type ResetBody = {
  email?: string;
  site?: string;
};

type SendResult = {
  ok: boolean;
  status?: number;
  reason?: string;
  detail?: string;
};

function parseRateLimitSeconds(message: string): number | null {
  const m = message.match(/after\s+(\d+)\s+seconds?/i);
  if (m) return Number(m[1]);
  return null;
}

function humanizeAuthDeliveryError(message: string): string {
  const lower = message.toLowerCase();
  const sec = parseRateLimitSeconds(message);
  if (sec != null) {
    return `Слишком частые запросы. Повторите через ${sec} сек.`;
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Слишком частые запросы. Подождите минуту и попробуйте снова.";
  }
  if (lower.includes("error sending recovery email") || lower.includes("error sending email")) {
    return "Supabase не смог отправить письмо через SMTP. Проверьте Authentication → Emails (логин/пароль mail.ru, порт 587, пароль приложения).";
  }
  return message;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getAppBaseUrl(request: NextRequest): string {
  // В dev сервер может стартовать на 3001/3002/3003...; берём фактический origin запроса.
  if (process.env.NODE_ENV !== "production") {
    return request.nextUrl.origin.replace(/\/$/, "");
  }

  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    request.nextUrl.origin;
  return raw.replace(/\/$/, "");
}

function buildResetEmailHtml(recoveryLink: string, siteSlug: string, appLoginUrl: string): string {
  const isSubsStore = siteSlug === "subs-store";
  const brandName = isSubsStore ? "Subs Store" : "GPT STORE";
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
                <td align="center" style="font-size:36px;line-height:1.2;font-weight:800;color:${headingColor};padding:6px 0 16px">
                  Сброс пароля
                </td>
              </tr>
              <tr>
                <td align="center" style="font-size:14px;line-height:1.6;color:${textColor};padding-bottom:18px">
                  Нажмите кнопку ниже, чтобы перейти к созданию нового пароля.
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:6px 0 18px">
                  <a href="${recoveryLink}" style="display:inline-block;background:${accentColor};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:700;">
                    Создать новый пароль
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center" style="font-size:12px;line-height:1.6;color:${textColor};padding-bottom:8px">
                  Если кнопка не работает, откройте ссылку:<br />
                  <a href="${recoveryLink}" style="color:${accentColor};text-decoration:underline;word-break:break-all">${recoveryLink}</a>
                </td>
              </tr>
              ${appLoginUrl ? `<tr>
                <td align="center" style="font-size:12px;line-height:1.6;color:${textColor};padding-bottom:8px">
                  Войти в кабинет: <a href="${appLoginUrl}" style="color:${accentColor};text-decoration:underline">${appLoginUrl}</a>
                </td>
              </tr>` : ""}
              <tr>
                <td align="center" style="font-size:12px;line-height:1.6;color:${textColor};padding-top:6px">
                  Если вы не запрашивали сброс пароля — проигнорируйте это письмо.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

async function sendViaResend(to: string, recoveryLink: string, siteSlug: string, appLoginUrl: string): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESET_PASSWORD_FROM_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.MAIL_FROM;
  if (!apiKey || !from) {
    return { ok: false, reason: "resend_not_configured" };
  }

  const isSubsStore = siteSlug === "subs-store";
  const subject = isSubsStore ? "Сброс пароля Subs Store" : "Сброс пароля GPT STORE";
  const html = buildResetEmailHtml(recoveryLink, siteSlug, appLoginUrl);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!response.ok) {
      let detail = "";
      try {
        const body = (await response.json()) as { message?: string };
        detail = body.message ?? "";
      } catch {
        /* noop */
      }
      return { ok: false, status: response.status, reason: "resend_rejected", detail };
    }
    return { ok: true, status: response.status };
  } catch {
    return { ok: false, reason: "resend_network_error" };
  }
}

export async function POST(request: NextRequest) {
  const isLocalRequest =
    request.nextUrl.hostname === "localhost" || request.nextUrl.hostname === "127.0.0.1";
  const canReturnDebug = process.env.NODE_ENV !== "production" || isLocalRequest;
  try {
    // Не раскрываем наличие/отсутствие аккаунта по ответу API.
    const genericOk = NextResponse.json({ ok: true, message: "Письмо отправлено" });

    const body = (await request.json().catch(() => ({}))) as ResetBody;
    const email = normalizeEmail(body.email ?? "");
    if (!email || !isValidEmail(email)) {
      return genericOk;
    }

    const siteSlug = body.site === "subs-store" ? "subs-store" : "gpt-store";
    const isSubsStore = siteSlug === "subs-store";

    if (isSubsStore) {
      if (!createSubsStoreAdminClient() || !getSubsPublicSupabaseUrl() || !getSubsPublicSupabaseAnonKey()) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Subs Supabase не настроен: проверьте SUBS_SUPABASE_* и NEXT_PUBLIC_SUBS_SUPABASE_* в .env.local",
          },
          { status: 503 },
        );
      }

      const allowed = await hasSubsStoreAuthUserByEmail(email);
      if (!allowed) {
        return NextResponse.json({
          ok: true,
          dispatched: false,
          reason: "no_subs_membership",
        });
      }
    }

    const appBaseUrl = getAppBaseUrl(request);
    // После сброса пароля для Subs — на витрину; для GPT — в кабинет.
    const postResetPath = isSubsStore ? "/dashboard?site=subs-store" : "/dashboard?site=gpt-store";
    const redirectTo = `${appBaseUrl}/auth/callback?type=recovery&site=${siteSlug}&returnUrl=${encodeURIComponent(postResetPath)}`;

    const appLoginUrl = isSubsStore
      ? `${appBaseUrl}/login?site=subs-store`
      : (process.env.NEXT_PUBLIC_APP_URL?.trim()
          ? `${process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "")}/login`
          : "");

    const debug: Record<string, unknown> = { redirectTo, siteSlug };

    /** Только при явном ENABLE_RESEND_RESET_PASSWORD=1. Иначе — SMTP из Supabase Dashboard (mail.ru и т.д.). */
    const useResendForReset = process.env.ENABLE_RESEND_RESET_PASSWORD === "1";

    const admin = isSubsStore ? createSubsStoreAdminClient()! : createAdminClient();

    async function buildRecoveryLinkFromAdmin(): Promise<string> {
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
      if (linkError) {
        debug.generateLinkError = linkError.message;
        return "";
      }
      const actionLink = linkData?.properties?.action_link ?? "";
      const hashedToken = linkData?.properties?.hashed_token ?? "";
      const callbackLink = hashedToken
        ? `${appBaseUrl}/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=recovery&site=${siteSlug}&returnUrl=${encodeURIComponent(postResetPath)}`
        : "";
      return callbackLink || actionLink;
    }

    async function sendViaSupabaseSmtp() {
      return isSubsStore
        ? createSupabaseJsClient(getSubsPublicSupabaseUrl(), getSubsPublicSupabaseAnonKey(), {
            auth: { autoRefreshToken: false, persistSession: false },
          }).auth.resetPasswordForEmail(email, { redirectTo })
        : (await createClient()).auth.resetPasswordForEmail(email, { redirectTo });
    }

    // ——— Режим Resend: generateLink + Resend (без resetPasswordForEmail — иначе двойной лимит) ———
    if (useResendForReset) {
      const recoveryLinkForEmail = await buildRecoveryLinkFromAdmin();
      if (!recoveryLinkForEmail) {
        const msg = humanizeAuthDeliveryError(String(debug.generateLinkError ?? "Не удалось создать ссылку"));
        const retryAfter = parseRateLimitSeconds(String(debug.generateLinkError ?? ""));
        return NextResponse.json(
          { ok: false, error: msg, retryAfter: retryAfter ?? undefined, channel: "generate_link_failed" },
          { status: 429 },
        );
      }

      const resendResult = await sendViaResend(email, recoveryLinkForEmail, siteSlug, appLoginUrl);
      debug.resend = resendResult;
      if (resendResult.ok) {
        const res = NextResponse.json({
          ok: true,
          channel: "resend",
          recoveryLink: canReturnDebug ? recoveryLinkForEmail : undefined,
        });
        res.cookies.set("auth_reset_site", siteSlug, {
          path: "/",
          maxAge: 60 * 60,
          sameSite: "lax",
          httpOnly: false,
        });
        return res;
      }

      const resendHint =
        resendResult.detail ||
        "Не удалось отправить письмо через Resend. Проверьте RESEND_API_KEY и домен в resend.com.";

      if (canReturnDebug) {
        return NextResponse.json({
          ok: true,
          channel: "resend_failed",
          recoveryLink: recoveryLinkForEmail,
          warning: resendHint,
        });
      }
      return NextResponse.json({ ok: false, error: resendHint, channel: "resend_failed" }, { status: 502 });
    }

    // ——— Режим Supabase SMTP (как в Dashboard → Authentication → Emails): один запрос = одно письмо ———
    const { error: supabaseError } = await sendViaSupabaseSmtp();
    debug.supabaseError = supabaseError?.message ?? null;

    if (!supabaseError) {
      let recoveryLinkForEmail = "";
      if (canReturnDebug) {
        recoveryLinkForEmail = await buildRecoveryLinkFromAdmin();
      }
      const res = NextResponse.json({
        ok: true,
        channel: "supabase",
        message: "Письмо отправлено через SMTP Supabase",
        recoveryLink: recoveryLinkForEmail || undefined,
      });
      res.cookies.set("auth_reset_site", siteSlug, {
        path: "/",
        maxAge: 60 * 60,
        sameSite: "lax",
        httpOnly: false,
      });
      return res;
    }

    const rateMsg = humanizeAuthDeliveryError(supabaseError.message);
    const retryAfter = parseRateLimitSeconds(supabaseError.message);
    const smtpIntervalHint =
      retryAfter != null
        ? " В Supabase → Authentication → Emails задан интервал между письмами одному пользователю (у вас ~60 сек)."
        : "";

    let recoveryLinkForEmail = "";
    if (canReturnDebug) {
      recoveryLinkForEmail = await buildRecoveryLinkFromAdmin();
    }

    if (recoveryLinkForEmail && canReturnDebug) {
      return NextResponse.json({
        ok: true,
        channel: "rate_limited_with_link",
        recoveryLink: recoveryLinkForEmail,
        warning: rateMsg + smtpIntervalHint,
        retryAfter: retryAfter ?? undefined,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: rateMsg + smtpIntervalHint,
        retryAfter: retryAfter ?? undefined,
        channel: "supabase_rate_limited",
        recoveryLink: recoveryLinkForEmail || undefined,
      },
      { status: 429 },
    );
  } catch (error) {
    console.error("[reset-password] unexpected error", error);
    // Никогда не показываем внутреннюю ошибку пользователю в этом флоу.
    if (canReturnDebug) {
      return NextResponse.json({
        ok: true,
        channel: "none",
        debug: {
          unexpectedError:
            error instanceof Error ? error.message : "unknown_error",
        },
      });
    }
    return NextResponse.json({ ok: true, message: "Письмо отправлено" });
  }
}

