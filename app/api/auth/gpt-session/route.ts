import { NextRequest, NextResponse } from "next/server";

import { finishGptLoginResponse } from "@/lib/auth/finish-gpt-login";
import { userFromGptAccessToken } from "@/lib/auth/parse-gpt-auth-cookie";

export const runtime = "nodejs";

type Body = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  returnUrl?: string;
};

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Неверный запрос" }, { status: 400 });
  }

  const access = typeof body.access_token === "string" ? body.access_token : "";
  const refresh = typeof body.refresh_token === "string" ? body.refresh_token : "";
  const parsed = userFromGptAccessToken(access);
  if (!access || !refresh || !parsed?.user) {
    return NextResponse.json({ error: "Сессия входа недействительна." }, { status: 401 });
  }

  return finishGptLoginResponse({
    accessToken: access,
    refreshToken: refresh,
    user: parsed.user,
    expiresAt: parsed.expiresAt ?? (typeof body.expires_at === "number" ? body.expires_at : undefined),
    returnUrl: body.returnUrl ?? "/cabinet",
  });
}
