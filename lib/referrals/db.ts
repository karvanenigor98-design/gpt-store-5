import type { SupabaseClient } from "@supabase/supabase-js";

import type { SiteSlug } from "@/lib/sites";
import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

import type { ReferralSettings } from "./types";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function referralDbForSite(siteSlug: SiteSlug): SupabaseClient | null {
  if (siteSlug === "subs-store") return createSubsStoreAdminClient();
  return createAdminClient();
}

export function generateReferralCode(): string {
  const tail = Array.from({ length: 8 }, () => alphabetPick()).join("");
  return tail;
}

function alphabetPick(): string {
  return ALPHABET[Math.floor(Math.random() * ALPHABET.length)] ?? "X";
}

export function buildReferralLink(siteSlug: SiteSlug, code: string, appUrl: string): string {
  const base = appUrl.replace(/\/$/, "");
  const path = siteSlug === "subs-store" ? "/spotify" : "/";
  return `${base}${path}?ref=${encodeURIComponent(code)}`;
}

export async function getReferralSettings(db: SupabaseClient): Promise<ReferralSettings> {
  const { data } = await db.from("referral_settings").select("*").eq("id", 1).maybeSingle();
  return {
    refereeDiscountPercent: Number(data?.referee_discount_percent ?? 10),
    referrerDiscountPercent: Number(data?.referrer_discount_percent ?? 10),
  };
}

export async function updateReferralSettings(
  db: SupabaseClient,
  patch: Partial<ReferralSettings>,
): Promise<ReferralSettings> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.refereeDiscountPercent != null) {
    row.referee_discount_percent = patch.refereeDiscountPercent;
  }
  if (patch.referrerDiscountPercent != null) {
    row.referrer_discount_percent = patch.referrerDiscountPercent;
  }
  const { data, error } = await db.from("referral_settings").upsert({ id: 1, ...row }).select("*").single();
  if (error) throw new Error(error.message);
  return {
    refereeDiscountPercent: Number(data.referee_discount_percent ?? 10),
    referrerDiscountPercent: Number(data.referrer_discount_percent ?? 10),
  };
}

export async function ensureUserReferralCode(
  db: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await db
    .from("profiles")
    .select("referral_code")
    .eq("id", userId)
    .maybeSingle();

  const existing = (profile?.referral_code as string | null)?.trim();
  if (existing) return existing.toUpperCase();

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateReferralCode();
    const { error } = await db.from("profiles").update({ referral_code: code }).eq("id", userId);
    if (!error) return code;
    if (!/duplicate|unique/i.test(error.message)) return null;
  }
  return null;
}

export async function resolveReferrerByCode(
  db: SupabaseClient,
  rawCode: string,
): Promise<{ id: string } | null> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;
  const { data } = await db
    .from("profiles")
    .select("id")
    .ilike("referral_code", code)
    .maybeSingle();
  return data?.id ? { id: String(data.id) } : null;
}

export async function attachReferralIfEmpty(
  db: SupabaseClient,
  referredUserId: string,
  referrerUserId: string,
): Promise<boolean> {
  if (referredUserId === referrerUserId) return false;

  const { data: profile } = await db
    .from("profiles")
    .select("referred_by_user_id")
    .eq("id", referredUserId)
    .maybeSingle();

  if (profile?.referred_by_user_id) return false;

  const { error } = await db
    .from("profiles")
    .update({ referred_by_user_id: referrerUserId })
    .eq("id", referredUserId)
    .is("referred_by_user_id", null);

  if (error) return false;

  await db.from("referral_events").upsert(
    {
      referrer_user_id: referrerUserId,
      referred_user_id: referredUserId,
      status: "pending",
    },
    { onConflict: "referred_user_id", ignoreDuplicates: true },
  );

  return true;
}

function promoExpiresIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function insertGptReferralPromo(
  db: SupabaseClient,
  opts: {
    code: string;
    percent: number;
    ownerUserId: string;
    referralEventId: string;
    maxUses: number;
  },
) {
  const until = promoExpiresIso(90);
  await db.from("promocodes").insert({
    code: opts.code,
    discount_type: "percent",
    discount_value: opts.percent,
    max_uses: opts.maxUses,
    uses_count: 0,
    valid_until: until,
    is_active: true,
    owner_user_id: opts.ownerUserId,
    referral_event_id: opts.referralEventId,
  });
}

async function insertSubsReferralPromo(
  db: SupabaseClient,
  opts: {
    code: string;
    percent: number;
    ownerUserId: string;
    referralEventId: string;
    maxUses: number;
  },
) {
  const until = promoExpiresIso(90);
  await db.from("promocodes").insert({
    code: opts.code,
    type: "percent",
    value: opts.percent,
    max_uses: opts.maxUses,
    used_count: 0,
    expires_at: until,
    is_active: true,
    owner_user_id: opts.ownerUserId,
    referral_event_id: opts.referralEventId,
  });
}

function uniquePromoCode(prefix: string): string {
  return `${prefix}-${Array.from({ length: 6 }, () => alphabetPick()).join("")}`;
}

export async function processReferralRewardOnFirstPaidOrder(opts: {
  siteSlug: SiteSlug;
  referredUserId: string;
  orderId: string;
}): Promise<void> {
  const db = referralDbForSite(opts.siteSlug);
  if (!db) return;

  const { countPaidOrdersForUser } = await import("@/lib/referrals/me");
  const paidCount = await countPaidOrdersForUser(db, opts.siteSlug, opts.referredUserId);
  if (paidCount > 1) return;

  const { data: profile } = await db
    .from("profiles")
    .select("referred_by_user_id")
    .eq("id", opts.referredUserId)
    .maybeSingle();

  const referrerId = profile?.referred_by_user_id as string | null;
  if (!referrerId) return;

  const { data: event } = await db
    .from("referral_events")
    .select("*")
    .eq("referred_user_id", opts.referredUserId)
    .maybeSingle();

  if (!event || event.status === "rewarded") return;

  const settings = await getReferralSettings(db);
  const eventId = String(event.id);

  const refereeCode = uniquePromoCode("FRIEND");
  const referrerCode = uniquePromoCode("REF");

  if (opts.siteSlug === "subs-store") {
    await insertSubsReferralPromo(db, {
      code: refereeCode,
      percent: settings.refereeDiscountPercent,
      ownerUserId: opts.referredUserId,
      referralEventId: eventId,
      maxUses: 1,
    });
    await insertSubsReferralPromo(db, {
      code: referrerCode,
      percent: settings.referrerDiscountPercent,
      ownerUserId: referrerId,
      referralEventId: eventId,
      maxUses: 1,
    });
  } else {
    await insertGptReferralPromo(db, {
      code: refereeCode,
      percent: settings.refereeDiscountPercent,
      ownerUserId: opts.referredUserId,
      referralEventId: eventId,
      maxUses: 1,
    });
    await insertGptReferralPromo(db, {
      code: referrerCode,
      percent: settings.referrerDiscountPercent,
      ownerUserId: referrerId,
      referralEventId: eventId,
      maxUses: 1,
    });
  }

  await db
    .from("referral_events")
    .update({
      status: "rewarded",
      first_order_id: opts.orderId,
      referee_promo_code: refereeCode,
      referrer_promo_code: referrerCode,
      rewarded_at: new Date().toISOString(),
    })
    .eq("id", eventId);
}
