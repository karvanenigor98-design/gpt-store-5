import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ReviewsModerationPanel } from "@/components/admin/ReviewsModerationPanel";
import { loadStaffReviewsPageData } from "@/lib/reviews/load-staff-reviews-page";

export const metadata: Metadata = { title: "Operator · Отзывы" };
export const dynamic = "force-dynamic";

export default async function OperatorReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; site?: string }>;
}) {
  const sp = await searchParams;
  const data = await loadStaffReviewsPageData({
    staffRoot: "/operator",
    statusParam: sp.status,
    siteParam: sp.site,
  });

  if (data.redirectTo) {
    redirect(data.redirectTo);
  }

  return (
    <ReviewsModerationPanel
      staffRoot="/operator"
      siteSlug={data.siteSlug}
      brandName={data.brandName}
      primaryColor={data.primaryColor}
      status={data.status}
      reviews={data.reviews}
      setupHint={data.setupHint}
      canDelete={false}
    />
  );
}
