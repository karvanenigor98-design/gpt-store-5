import { NextRequest, NextResponse } from "next/server";

import { getGptPublicSupabaseUrl } from "@/lib/supabase/validate-project-url";

export const runtime = "edge";

const GOTRUE = "https://cgamktdrqkxnnmnruvvq.supabase.co";

/** Password grant from Vercel Edge (CF network), not Node fra1 and not RU DNS. */
export async function POST(request: NextRequest) {
  let email = "";
  let password = "";
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Неверный запрос" }, { status: 400 });
  }
  if (!email || password.length < 6) {
    return NextResponse.json({ error: "Укажите email и пароль" }, { status: 400 });
  }

  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!anon) {
    return NextResponse.json({ error: "Сервер входа не настроен" }, { status: 503 });
  }

  const base = getGptPublicSupabaseUrl() || GOTRUE;
  try {
    const grantRes = await fetch(`${base}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(8_000),
    });
    const grantJson = (await grantRes.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(grantJson, { status: grantRes.status });
  } catch {
    return NextResponse.json({ error: "Сервер входа не ответил", code: "auth_timeout" }, { status: 503 });
  }
}
