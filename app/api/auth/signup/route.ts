import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { logAuthEmailAttempt } from "@/lib/auth/auth-email-log";
import { defaultCustomerDashboard } from "@/lib/auth/authReturnUrl";
import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";
import { getEmailConfirmationState } from "@/lib/auth/get-auth-user-by-email";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmail";
import {
  humanizeSignupEmailError,
  sendSignupConfirmationEmail,
} from "@/lib/auth/send-signup-confirmation-email";
import { tryCreateAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

const signupBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  site: z.enum(["gpt-store", "subs-store"]).optional(),
  returnUrl: z.string().optional(),
});

function getAppBaseUrl(request: NextRequest): string {
  if (process.env.NODE_ENV !== "production") {
    return request.nextUrl.origin.replace(/\/$/, "");
  }
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    request.nextUrl.origin;
  return raw.replace(/\/$/, "");
}

function getAdminClient(siteSlug: AuthSiteSlug) {
  return siteSlug === "subs-store" ? createSubsStoreAdminClient() : tryCreateAdminClient();
}

function isDuplicateUserError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("already") ||
    m.includes("registered") ||
    m.includes("exists") ||
    m.includes("duplicate")
  );
}

export async function POST(request: NextRequest) {
  try {
    const parsed = signupBodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Проверьте email и пароль (минимум 8 символов)." },
        { status: 400 },
      );
    }

    const email = normalizeEmailForAuth(parsed.data.email);
    const password = parsed.data.password;
    const siteSlug: AuthSiteSlug =
      parsed.data.site === "subs-store" ? "subs-store" : "gpt-store";
    const returnUrl =
      typeof parsed.data.returnUrl === "string" &&
      parsed.data.returnUrl.startsWith("/") &&
      !parsed.data.returnUrl.startsWith("//")
        ? parsed.data.returnUrl
        : defaultCustomerDashboard(siteSlug);
    const appBaseUrl = getAppBaseUrl(request);

    const admin = getAdminClient(siteSlug);
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Сервис регистрации временно недоступен." },
        { status: 503 },
      );
    }

    const existing = await getEmailConfirmationState(email, siteSlug);

    if (existing.exists && existing.emailConfirmed) {
      return NextResponse.json(
        { ok: false, code: "already_registered", error: "Этот email уже зарегистрирован." },
        { status: 409 },
      );
    }

    if (existing.exists && !existing.emailConfirmed && existing.userId) {
      const { error: updateError } = await admin.auth.admin.updateUserById(existing.userId, {
        password,
        user_metadata: { signup_site: siteSlug },
      });
      if (updateError) {
        console.error("[signup] update unconfirmed user:", updateError.message);
      }
    } else if (!existing.exists) {
      const { error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: { signup_site: siteSlug },
      });

      if (createError) {
        if (isDuplicateUserError(createError.message)) {
          const retryState = await getEmailConfirmationState(email, siteSlug);
          if (retryState.emailConfirmed) {
            return NextResponse.json(
              { ok: false, code: "already_registered", error: "Этот email уже зарегистрирован." },
              { status: 409 },
            );
          }
          if (retryState.userId) {
            await admin.auth.admin.updateUserById(retryState.userId, {
              password,
              user_metadata: { signup_site: siteSlug },
            });
          }
        } else {
          logAuthEmailAttempt({
            event: "signup_send",
            email,
            siteSlug,
            ok: false,
            error: createError.message,
            trigger: "post_signup",
          });
          return NextResponse.json(
            {
              ok: false,
              error: humanizeSignupEmailError(createError.message) || "Не удалось создать аккаунт.",
            },
            { status: 503 },
          );
        }
      }
    }

    const emailResult = await sendSignupConfirmationEmail({
      email,
      siteSlug,
      returnUrl,
      appBaseUrl,
      trigger: "post_signup",
    });

    if (emailResult.alreadyConfirmed) {
      return NextResponse.json({
        ok: true,
        needsVerification: false,
        alreadyConfirmed: true,
      });
    }

    if (!emailResult.ok) {
      return NextResponse.json({
        ok: true,
        needsVerification: true,
        emailSent: false,
        deliveryPending: Boolean(emailResult.deliveryPending),
        email,
      });
    }

    return NextResponse.json({
      ok: true,
      needsVerification: true,
      emailSent: true,
      email,
      channel: emailResult.channel,
    });
  } catch (error) {
    console.error("[signup]", error);
    return NextResponse.json(
      { ok: false, error: "Внутренняя ошибка. Попробуйте позже." },
      { status: 500 },
    );
  }
}
