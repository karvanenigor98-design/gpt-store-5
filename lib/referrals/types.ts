import type { SiteSlug } from "@/lib/sites";

export type ReferralSettings = {
  refereeDiscountPercent: number;
  referrerDiscountPercent: number;
};

export type ReferralMePayload = {
  referralCode: string;
  referralLink: string;
  referredCount: number;
  pendingRewards: Array<{
    role: "referee" | "referrer";
    code: string;
    discountPercent: number;
    expiresAt: string | null;
  }>;
};

export type ReferralAdminUserRow = {
  id: string;
  email: string | null;
  referralCode: string | null;
  referredByEmail: string | null;
  referredByUserId: string | null;
  referralsCount: number;
  ordersCount: number;
  paidTotal: number;
};

export type ReferralSite = SiteSlug;
