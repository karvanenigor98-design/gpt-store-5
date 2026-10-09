import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import { finishGptLoginResponse } from "@/lib/auth/finish-gpt-login";

export const runtime = "edge";

type Body = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  user?: User;
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
  let user = body.user;
  if ((!user?.id || user.id.length < 8) && access.split(".").length >= 3) {
    try {
      const b64 = access.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const json =
        typeof atob === "function"
          ? atob(b64)
          : Buffer.from(b64, "base64").toString("utf8");
      const payload = JSON.parse(json) as { sub?: string; email?: string };
      if (payload.sub) {
        user = {
          id: payload.sub,
          email: payload.email || user?.email || "",
          aud: "authenticated",
          app_metadata: {},
          user_metadata: {},
          created_at: "",
        } as User;
      }
    } catch {
      /* keep body.user */
    }
  }
  if (!access || !refresh || !user?.id || access.split(".").length < 3) {
    return NextResponse.json({ error: "Нет сессии" }, { status: 400 });
  }

  const expiresAt =
    typeof body.expires_at === "number"
      ? body.expires_at
      : typeof body.expires_in === "number"
        ? Math.floor(Date.now() / 1000) + body.expires_in
        : undefined;

  return finishGptLoginResponse({
    accessToken: access,
    refreshToken: refresh,
    user,
    expiresAt,
    returnUrl: body.returnUrl ?? "/cabinet",
  });
}
