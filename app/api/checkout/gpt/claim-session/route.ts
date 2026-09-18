import { NextRequest, NextResponse } from "next/server";

import { isGptGuestCheckoutEnabled } from "@/lib/checkout/gpt-guest-checkout-flag";
import {
  applyGptPayerSessionCookies,
  completeGptPayerLogin,
  findRecentPaidGptOrderIdByEmail,
} from "@/lib/checkout/complete-gpt-payer-login";
import { canAccessOrderStatus } from "@/lib/payments/order-status-access";

export const maxDuration = 30;

/**
 * After verified Pally payment: open a real session on THIS device
 * (laptop cookie, phone QR return, or the same checkout email).
 */
export async function POST(request: NextRequest) {
  if (!isGptGuestCheckoutEnabled()) {
    return NextResponse.json({ error: "Unavailable" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    orderId?: string;
    email?: string;
  };
  let orderId = body.orderId?.trim() ?? "";

  if (!orderId && body.email?.trim()) {
    const found = await findRecentPaidGptOrderIdByEmail(body.email);
    if (!found) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    orderId = found;
  }

  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const allowed = await canAccessOrderStatus(orderId, "gpt-store");
  if (!allowed && !body.email?.trim()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await completeGptPayerLogin(orderId);
  if (!result.ok && "pending" in result && result.pending) {
    return NextResponse.json({ ok: false, pending: true }, { status: 202 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const res = NextResponse.json({ ok: true, redirectTo: result.redirectTo });
  return applyGptPayerSessionCookies(res, orderId, result.pending);
}
