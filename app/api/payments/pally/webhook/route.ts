import { NextRequest, NextResponse } from "next/server";

import {
  confirmPallyWebhookViaApi,
  verifyPallyWebhook,
} from "@/lib/payments/pally-webhook-verify";
import { parsePallyWebhookRequestBody } from "@/lib/payments/pally-webhook-body";
import { processPallyWebhook } from "@/lib/payments/process-pally-webhook";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await parsePallyWebhookRequestBody(request);

    const sign =
      request.headers.get("x-pally-sign") ??
      request.headers.get("x-sign") ??
      String(body.sign ?? body.SignatureValue ?? "");

    let signatureOk = verifyPallyWebhook(body, sign);
    if (!signatureOk && process.env.PALLY_WEBHOOK_ALLOW_API_CONFIRM === "true") {
      signatureOk = await confirmPallyWebhookViaApi(body);
      if (signatureOk) {
        console.warn(
          "[Pally webhook] signature mismatch, confirmed via Pally API",
          String(body.order_id ?? body.InvId ?? ""),
        );
      }
    }
    if (!signatureOk) {
      const missing = !sign?.trim();
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
