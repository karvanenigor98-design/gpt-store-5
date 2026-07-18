import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ReviewsModerationPanel } from "@/components/admin/ReviewsModerationPanel";
import { loadStaffReviewsPageData } from "@/lib/reviews/load-staff-reviews-page";

export const metadata: Metadata = { title: "Admin · Отзывы" };
export const dynamic = "force-dynamic";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; site?: string; panel?: string }>;
}) {
  const sp = await searchParams;
  // Legacy: operator panel used to re-export this page with panel=operator.
  const staffRoot = sp.panel === "operator" ? "/operator" : "/admin";
  const data = await loadStaffReviewsPageData({
    staffRoot,
    statusParam: sp.status,
    siteParam: sp.site,
  });

  if (data.redirectTo) {
    redirect(data.redirectTo);
  }

  return (
    <ReviewsModerationPanel
      staffRoot={staffRoot}
      siteSlug={data.siteSlug}
      brandName={data.brandName}
      primaryColor={data.primaryColor}
      status={data.status}
      reviews={data.reviews}
      setupHint={data.setupHint}
      canDelete={staffRoot === "/admin"}
    />
  );
}
