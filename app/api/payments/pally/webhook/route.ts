import { NextRequest, NextResponse } from "next/server";

import { verifyPallyWebhook } from "@/lib/payments/pally";
import { processPallyWebhook } from "@/lib/payments/process-pally-webhook";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const sign =
      request.headers.get("x-pally-sign") ??
      request.headers.get("x-sign") ??
      String(body.sign ?? "");

    if (sign && !verifyPallyWebhook(body, sign)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const result = await processPallyWebhook(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Pally webhook]", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
