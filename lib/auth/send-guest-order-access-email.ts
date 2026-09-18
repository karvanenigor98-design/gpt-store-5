import { getEmailConfirmationState } from "@/lib/auth/get-auth-user-by-email";
import { buildGuestOrderAccessUrl } from "@/lib/auth/guest-order-access";
import { createAdminClient } from "@/lib/supabase/server";
import { sendTransactionalEmail } from "@/lib/email/send-email";
import { getPublicBrandName } from "@/lib/sites";

function safeOrigin(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function guestOrderAccessReturnPaths(orderId: string): {
  chat: string;
  account: string;
} {
  const id = encodeURIComponent(orderId);
  return {
    chat: "/dashboard/chat?site=gpt-store",
    account: `/dashboard/orders?site=gpt-store&highlightOrder=${id}`,
  };
}

const BTN =
  "display:inline-block;padding:12px 18px;border-radius:10px;font-weight:600;text-decoration:none;font-size:15px";

export function buildGuestOrderAccessEmailBodies(params: {
  chatUrl: string;
  accountUrl: string;
}): { text: string; html: string } {
  const { chatUrl, accountUrl } = params;
  const text = [
    "Успешная оплата.",
    "Заказ принят. Напишите оператору в чат — он подключит подписку.",
    "",
    `Написать оператору: ${chatUrl}`,
    "",
    "Ваш аккаунт на сайте уже создан на этот email. Статус заказа — в кабинете:",
    `Открыть мой аккаунт: ${accountUrl}`,
  ].join("\n");
  const html = `<p style="font-size:18px;font-weight:700;margin:0 0 12px">Успешная оплата</p>
<p style="margin:0 0 16px;line-height:1.5">Заказ принят. Напишите оператору в чат — он подключит подписку.</p>
<p style="margin:0 0 20px"><a href="${chatUrl}" style="${BTN};background:#10a37f;color:#ffffff">Написать оператору</a></p>
<p style="margin:0 0 12px;line-height:1.5">Ваш аккаунт на сайте уже создан на этот email. Статус заказа смотрите в кабинете.</p>
<p style="margin:0 0 16px"><a href="${accountUrl}" style="${BTN};background:#111827;color:#ffffff">Открыть мой аккаунт</a></p>`;
  return { text, html };
}

async function markGuestAccessEmailSent(orderId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.from("orders").select("meta").eq("id", orderId).maybeSingle();
  const prev = (data?.meta && typeof data.meta === "object" ? data.meta : {}) as Record<string, unknown>;
  await admin
    .from("orders")
    .update({
      meta: { ...prev, guest_access_email_sent_at: new Date().toISOString() },
    })
    .eq("id", orderId);
}

/**
 * After verified payment: one email, two durable signed links (chat + cabinet).
 * Links do not use a one-time Supabase OTP, so return-to-site login cannot kill them.
 */
export async function sendGuestOrderAccessEmail(params: {
  email: string;
  orderId: string;
  checkoutOrigin?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const email = params.email.trim().toLowerCase();
    if (!email) return { ok: false, error: "no_email" };

    const admin = createAdminClient();
    const { data: existingOrder } = await admin
      .from("orders")
      .select("meta")
      .eq("id", params.orderId)
      .maybeSingle();
    const meta = (existingOrder?.meta ?? null) as Record<string, unknown> | null;
    if (typeof meta?.guest_access_email_sent_at === "string") {
      return { ok: true };
    }

    const existing = await getEmailConfirmationState(email, "gpt-store");
    if (existing.userId && !existing.emailConfirmed) {
      await admin.auth.admin.updateUserById(existing.userId, { email_confirm: true });
    }
    if (existing.userId) {
      const { getOrCreateClientOperatorSession } = await import("@/lib/chat/operatorSession");
      await getOrCreateClientOperatorSession(admin, existing.userId, "gpt-store").catch(() => undefined);
    }

    const origin = safeOrigin(params.checkoutOrigin);
    const appBaseUrl = origin ?? "https://gptplus-store.ru";
    const chatUrl = buildGuestOrderAccessUrl(appBaseUrl, params.orderId, "chat");
    const accountUrl = buildGuestOrderAccessUrl(appBaseUrl, params.orderId, "account");

    const brand = getPublicBrandName("gpt-store");
    const bodies = buildGuestOrderAccessEmailBodies({ chatUrl, accountUrl });
    const result = await sendTransactionalEmail(
      email,
      `${brand}: успешная оплата`,
      bodies.text,
      bodies.html,
      { siteSlug: "gpt-store", purpose: "auth" },
    );
    if (result.ok) {
      await markGuestAccessEmailSent(params.orderId).catch(() => undefined);
    }
    return { ok: result.ok, error: result.error };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "access_email_failed" };
  }
}
