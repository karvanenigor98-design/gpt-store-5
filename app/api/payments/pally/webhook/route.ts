import { NextRequest, NextResponse } from "next/server";

import { verifyPallyWebhook } from "@/lib/payments/pally";
import { parsePallyWebhookRequestBody } from "@/lib/payments/pally-webhook-body";
import { processPallyWebhook } from "@/lib/payments/process-pally-webhook";

export async function POST(request: NextRequest) {
  try {
    const body = await parsePallyWebhookRequestBody(request);

    const sign =
      request.headers.get("x-pally-sign") ??
      request.headers.get("x-sign") ??
      String(body.sign ?? "");

    if (!verifyPallyWebhook(body, sign)) {
      const missing =
        process.env.PALLY_WEBHOOK_REQUIRE_SIGN === "true" && !sign?.trim();
      return NextResponse.json(
        { error: missing ? "Missing signature" : "Invalid signature" },
        { status: 400 },
      );
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
