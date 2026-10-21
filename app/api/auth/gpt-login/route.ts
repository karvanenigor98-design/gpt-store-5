import { NextRequest, NextResponse } from "next/server";

import { authRateLimitUserMessage, isAuthRateLimitError } from "@/lib/auth/auth-rate-limit";
import { finishGptLoginResponse } from "@/lib/auth/finish-gpt-login";
import { gptPasswordGrantIpv4 } from "@/lib/auth/gpt-password-grant-node";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmail";

export const runtime = "nodejs";
export const preferredRegion = ["fra1"];
export const maxDuration = 25;

type Body = {
  email?: string;
  password?: string;
  returnUrl?: string;
};

function wantsHtmlRedirect(request: NextRequest): boolean {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    return true;
  }
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html") && !accept.includes("application/json");
}

function loginErrorRedirect(request: NextRequest, code: string, email: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("error", code);
  url.searchParams.set("site", "gpt-store");
  if (email) url.searchParams.set("email", email);
  return NextResponse.redirect(url, 303);
}

async function readBody(request: NextRequest): Promise<Body> {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    const form = await request.formData();
    return {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      returnUrl: String(form.get("returnUrl") ?? "/cabinet"),
    };
  }
  return (await request.json()) as Body;
}

export async function POST(request: NextRequest) {
  const html = wantsHtmlRedirect(request);
  let body: Body;
  try {
    body = await readBody(request);
  } catch {
    if (html) return loginErrorRedirect(request, "bad_request", "");
    return NextResponse.json({ error: "Неверный запрос" }, { status: 400 });
  }

  const email = normalizeEmailForAuth(body.email ?? "");
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || password.length < 6) {
    if (html) return loginErrorRedirect(request, "invalid", email);
    return NextResponse.json(
      { error: "Укажите email и пароль (минимум 6 символов)." },
      { status: 400 },
    );
  }

  const grant = await gptPasswordGrantIpv4(email, password, 8_000);
  if (!grant.ok) {
    console.error("gpt-login grant failed", grant.status, grant.message);
    if (grant.message === "timeout" || grant.message === "auth_network") {
      if (html) return loginErrorRedirect(request, "timeout", email);
      return NextResponse.json(
        {
          error: "Сервер входа не ответил. Повторите попытку.",
          code: "auth_timeout",
          detail: grant.message,
        },
        { status: 503 },
      );
    }
    if (isAuthRateLimitError(grant.message)) {
      if (html) return loginErrorRedirect(request, "rate", email);
      return NextResponse.json(
        { error: authRateLimitUserMessage(grant.message), code: "rate_limited" },
        { status: 429 },
      );
    }
    if (html) return loginErrorRedirect(request, "invalid", email);
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
    origin: request.nextUrl.origin,
    redirect: html,
  });
}
