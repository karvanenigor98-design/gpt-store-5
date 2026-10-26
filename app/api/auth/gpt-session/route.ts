import { NextRequest, NextResponse } from "next/server";

import { finishGptLoginResponse } from "@/lib/auth/finish-gpt-login";
import { userFromAccessToken } from "@/lib/auth/gpt-password-grant-node";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmail";

export const runtime = "nodejs";
export const maxDuration = 10;

type Body = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  returnUrl?: string;
  email?: string;
};

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Неверный запрос" }, { status: 400 });
  }

  const accessToken = typeof body.accessToken === "string" ? body.accessToken : "";
  const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken : "";
  const email = normalizeEmailForAuth(body.email ?? "");
  const user = userFromAccessToken(accessToken, email);
  if (!accessToken || !refreshToken || !user?.id) {
    return NextResponse.json({ error: "Сессия входа повреждена. Войдите снова." }, { status: 401 });
  }

  return finishGptLoginResponse({
    accessToken,
    refreshToken,
    user,
    expiresAt: typeof body.expiresAt === "number" ? body.expiresAt : undefined,
    returnUrl: body.returnUrl ?? "/cabinet",
    origin: request.nextUrl.origin,
    redirect: false,
  });
}
