import { NextResponse } from "next/server";

export const runtime = "edge";
export const maxDuration = 5;

/** Do not call GoTrue from this function — Vercel egress hangs until 30s 504. Grant is /__sb-auth + gpt-session. */
export async function POST() {
  return NextResponse.json(
    { error: "Сервер входа не ответил. Обновите страницу и войдите снова.", code: "auth_timeout" },
    { status: 503 },
  );
}
