import { NextRequest, NextResponse } from "next/server";

import { authRateLimitUserMessage, isAuthRateLimitError } from "@/lib/auth/auth-rate-limit";
import { finishGptLoginResponse } from "@/lib/auth/finish-gpt-login";
import { gptPasswordGrantIpv4 } from "@/lib/auth/gpt-password-grant-node";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmail";

export const runtime = "nodejs";
export const preferredRegion = ["fra1"];
export const maxDuration = 12;

type Body = {
  email?: string;
  password?: string;
  returnUrl?: string;
};

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Неверный запрос" }, { status: 400 });
  }

  const email = normalizeEmailForAuth(body.email ?? "");
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || password.length < 6) {
    return NextResponse.json(
      { error: "Укажите email и пароль (минимум 6 символов)." },
      { status: 400 },
    );
  }

  const grant = await gptPasswordGrantIpv4(email, password, 8_000);
  if (!grant.ok) {
    if (grant.message === "timeout" || grant.message === "auth_network") {
      return NextResponse.json(
        { error: "Сервер входа не ответил. Повторите попытку.", code: "auth_timeout" },
        { status: 503 },
      );
    }
    if (isAuthRateLimitError(grant.message)) {
      return NextResponse.json(
        { error: authRateLimitUserMessage(grant.message), code: "rate_limited" },
        { status: 429 },
      );
    }
    return NextResponse.json(
      {
        error: "Неверный email или пароль. Если забыли пароль — восстановите через /reset-password.",
        code: "invalid_credentials",
      },
      { status: 401 },
    );
  }

  return finishGptLoginResponse({
    accessToken: grant.accessToken,
    refreshToken: grant.refreshToken,
    user: grant.user,
    expiresAt: grant.expiresAt,
    returnUrl: body.returnUrl ?? "/cabinet",
  });
}
