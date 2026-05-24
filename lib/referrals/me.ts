import type { SupabaseClient } from "@supabase/supabase-js";

import type { SiteSlug } from "@/lib/sites";

import { buildReferralLink, ensureUserReferralCode } from "./db";
import type { ReferralMePayload } from "./types";

const GPT_PAID = new Set(["paid", "activating", "active", "waiting_client"]);
const SUBS_PAID = new Set(["paid", "processing", "activating", "activated", "completed", "awaiting_operator"]);

export async function fetchReferralMe(
  db: SupabaseClient,
  siteSlug: SiteSlug,
  userId: string,
  appUrl: string,
): Promise<ReferralMePayload | null> {
  const code = await ensureUserReferralCode(db, userId);
  if (!code) return null;

  const { count: referredCount } = await db
    .from("referral_events")
    .select("*", { count: "exact", head: true })
    .eq("referrer_user_id", userId);

  const pendingRewards: ReferralMePayload["pendingRewards"] = [];

  const isGpt = siteSlug === "gpt-store";
  const promoSelect = isGpt
    ? "code, discount_value, valid_until, max_uses, uses_count"
    : "code, value, expires_at, max_uses, used_count";

  const { data: ownedPromos } = await db
    .from("promocodes")
    .select(promoSelect)
    .eq("owner_user_id", userId)
    .eq("is_active", true)
    .not("referral_event_id", "is", null);

  for (const raw of ownedPromos ?? []) {
    const row = raw as Record<string, unknown>;
    const codeVal = String(row.code ?? "").toUpperCase();
    const percent = Number(isGpt ? row.discount_value : row.value);
    const used = Number(isGpt ? row.uses_count : row.used_count);
    const maxUses = row.max_uses as number | null;
    if (maxUses != null && used >= maxUses) continue;
    pendingRewards.push({
      role: "referrer",
      code: codeVal,
      discountPercent: percent,
      expiresAt: (isGpt ? row.valid_until : row.expires_at) as string | null,
    });
  }

  const { data: event } = await db
    .from("referral_events")
    .select("referee_promo_code, referrer_promo_code, status")
    .eq("referred_user_id", userId)
    .eq("status", "rewarded")
    .maybeSingle();

  if (event?.referee_promo_code) {
    pendingRewards.push({
      role: "referee",
      code: String(event.referee_promo_code).toUpperCase(),
      discountPercent: 0,
      expiresAt: null,
    });
  }

  return {
    referralCode: code,
    referralLink: buildReferralLink(siteSlug, code, appUrl),
    referredCount: referredCount ?? 0,
    pendingRewards,
  };
}

export async function countPaidOrdersForUser(
  db: SupabaseClient,
  siteSlug: SiteSlug,
  userId: string,
): Promise<number> {
  if (siteSlug === "subs-store") {
    const { data } = await db.from("orders").select("status").eq("user_id", userId);
    return (data ?? []).filter((o) => SUBS_PAID.has(String(o.status ?? "").toLowerCase())).length;
  }
  const { data } = await db.from("orders").select("status").eq("user_id", userId);
  return (data ?? []).filter((o) => GPT_PAID.has(String(o.status ?? "").toLowerCase())).length;
}
