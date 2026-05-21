import { CHATGPT_PLANS, REVIEWS } from "@/lib/chatgpt-data";
import type { PublicReview } from "@/lib/reviews/publicReviews";
import type { StoreConfig } from "@/lib/store-config";

export const GPT_LANDING_STATIC_CONFIG: StoreConfig = {
  plans: [...CHATGPT_PLANS.plus, ...CHATGPT_PLANS.pro],
  promoCodes: [],
  landingSections: { showReviews: true, showFaq: true, showCompare: true },
  landingDiscounts: [],
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

/** Статические отзывы — лендинг не падает, если Supabase недоступен или диск переполнен. */
export function getStaticGptLandingReviews(limit = 40): PublicReview[] {
  return REVIEWS.slice(0, limit).map((review, idx) => {
    const authorKey = review.name.trim().toLowerCase();
    return {
      id: `static-${idx}`,
      authorName: review.name,
      authorUsername: null,
      content: review.text,
      rating: 5,
      dateLabel: review.date,
      sourceUrl: null,
      inSiteProfileUrl: `/reviews?author=${encodeURIComponent(authorKey)}`,
      avatarColor: review.avatarColor,
      initials: review.initials || initialsFromName(review.name),
    };
  });
}

export function getStaticGptLandingPayload() {
  return {
    storeConfig: GPT_LANDING_STATIC_CONFIG,
    reviews: getStaticGptLandingReviews(40),
  };
}
