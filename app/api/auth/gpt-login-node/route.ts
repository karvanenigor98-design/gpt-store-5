import { NextResponse } from "next/server";

export const runtime = "edge";
export const maxDuration = 5;

export async function POST() {
  return NextResponse.json(
    { error: "Сервер входа не ответил. Обновите страницу и войдите снова.", code: "auth_timeout" },
    { status: 503 },
  );
}
