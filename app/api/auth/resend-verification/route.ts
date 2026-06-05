import { NextRequest, NextResponse } from "next/server";

import { defaultCustomerDashboard } from "@/lib/auth/authReturnUrl";
import {
  sendSignupConfirmationEmail,
  type SendSignupConfirmationTrigger,
} from "@/lib/auth/send-signup-confirmation-email";

type Body = {
  email?: string;
  site?: string;
  returnUrl?: string;
  trigger?: SendSignupConfirmationTrigger;
};

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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const siteSlug = body.site === "subs-store" ? "subs-store" : "gpt-store";
    const returnUrl =
      typeof body.returnUrl === "string" && body.returnUrl.startsWith("/")
        ? body.returnUrl
        : defaultCustomerDashboard(siteSlug);
    const trigger: SendSignupConfirmationTrigger =
      body.trigger === "post_signup" ? "post_signup" : "manual_resend";

    const result = await sendSignupConfirmationEmail({
      email: body.email ?? "",
      siteSlug,
      returnUrl,
      appBaseUrl: getAppBaseUrl(request),
      trigger,
    });

    if (result.alreadyConfirmed) {
      return NextResponse.json({
        ok: true,
        alreadyConfirmed: true,
        message: "Email уже подтверждён",
      });
    }

    if (result.deliveryPending) {
      return NextResponse.json({
        ok: false,
        deliveryPending: true,
        error: result.error ?? "Письмо не отправлено через Resend/SMTP",
        hint: "Проверьте почту — возможно, письмо уже отправлено при регистрации. Если его нет — нажмите «Отправить повторно».",
      });
    }

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error ?? "Не удалось отправить письмо",
          retryAfter: result.retryAfter,
        },
        { status: result.retryAfter ? 429 : 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      channel: result.channel,
      message: "Письмо отправлено",
    });
  } catch (error) {
    console.error("[resend-verification]", error);
    return NextResponse.json(
      { ok: false, error: "Внутренняя ошибка. Попробуйте позже." },
      { status: 500 },
    );
  }
}
