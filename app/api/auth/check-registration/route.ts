import { NextRequest, NextResponse } from "next/server";

import { hasGptStoreAuthUserByEmail } from "@/lib/auth/gptAuthByEmail";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmail";
import { hasSubsStoreAuthUserByEmail } from "@/lib/auth/subsMembershipByEmail";

export async function POST(req: NextRequest) {
  let body: { email?: string; site?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const email = normalizeEmailForAuth(body.email ?? "");
  if (!email) {
    return NextResponse.json({ exists: false });
  }

  const site = body.site === "subs-store" ? "subs-store" : "gpt-store";
  const exists =
    site === "subs-store" ? await hasSubsStoreAuthUserByEmail(email) : await hasGptStoreAuthUserByEmail(email);

  return NextResponse.json({ exists, site });
}
