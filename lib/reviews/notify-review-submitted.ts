import { notifyNewReview } from "@/lib/telegram/notifications";

export async function notifyReviewSubmitted(params: {
  siteSlug: "gpt-store" | "subs-store";
  reviewId: string;
  authorName: string;
  content: string;
}): Promise<void> {
  await notifyNewReview({
    author_name: params.authorName,
    content: params.content,
    siteSlug: params.siteSlug,
    reviewId: params.reviewId,
  });
}
