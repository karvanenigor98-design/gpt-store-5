import { NextRequest, NextResponse } from "next/server";

import { getEmailConfirmationState } from "@/lib/auth/get-auth-user-by-email";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmail";

export async function POST(req: NextRequest) {
  let body: { email?: string; site?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const email = normalizeEmailForAuth(body.email ?? "");
  if (!email) {
    return NextResponse.json({ exists: false, emailConfirmed: false });
  }

  const site = body.site === "subs-store" ? "subs-store" : "gpt-store";
  const state = await getEmailConfirmationState(email, site);

  return NextResponse.json({
    exists: state.exists,
    emailConfirmed: state.emailConfirmed,
    site,
  });
}
