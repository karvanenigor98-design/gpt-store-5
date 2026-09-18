import crypto from "crypto";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { getEmailConfirmationState } from "@/lib/auth/get-auth-user-by-email";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmail";
import { ensureGptProfile } from "@/lib/orders/create-gpt-order";
import type { Database } from "@/types/database";

type Admin = SupabaseClient<Database>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isCheckoutContactEmail(raw: string): boolean {
  const email = normalizeEmailForAuth(raw);
  return EMAIL_RE.test(email);
}

export type GptGuestBuyer = {
  userId: string;
  email: string;
  existed: boolean;
};

function randomCheckoutPassword(): string {
  return `${crypto.randomBytes(24).toString("base64url")}Aa1!`;
}

/**
 * Resolves Auth user for guest Pay. Never creates a browser session.
 * Existing email → reuse user_id (order lands on that account; access only after email proof).
 */
export async function resolveGptGuestBuyer(
  admin: Admin,
  rawEmail: string,
): Promise<GptGuestBuyer | { error: string; status: number }> {
  const email = normalizeEmailForAuth(rawEmail);
  if (!EMAIL_RE.test(email)) {
    return { error: "Укажите корректный email", status: 400 };
  }

  const existing = await getEmailConfirmationState(email, "gpt-store");
  if (existing.exists && existing.userId) {
    if (!existing.emailConfirmed) {
      await admin.auth.admin.updateUserById(existing.userId, { email_confirm: true });
    }
    const { data } = await admin.auth.admin.getUserById(existing.userId);
    const user = data.user;
    if (user) {
      await ensureGptProfile(admin, user as User);
    }
    return { userId: existing.userId, email, existed: true };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: randomCheckoutPassword(),
    email_confirm: true,
    user_metadata: { signup_site: "gpt-store", created_via: "guest_checkout" },
  });

  if (error || !data.user) {
    const retry = await getEmailConfirmationState(email, "gpt-store");
    if (retry.userId) {
      return { userId: retry.userId, email, existed: true };
    }
    return {
      error: "Не удалось подготовить заказ. Проверьте email или войдите в аккаунт.",
      status: 503,
    };
  }

  await ensureGptProfile(admin, data.user as User);
  return { userId: data.user.id, email, existed: false };
}
