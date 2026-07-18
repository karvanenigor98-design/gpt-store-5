import type { Metadata } from "next";

import AdminReviewsPage from "../../../(admin)/admin/reviews/page";

export const metadata: Metadata = { title: "Operator · Отзывы" };

export default async function OperatorReviewsPage(props: {
  searchParams: Promise<{ status?: string; site?: string }>;
}) {
  const searchParams = await props.searchParams;
  return <AdminReviewsPage searchParams={Promise.resolve({ ...searchParams, panel: "operator" })} />;
}
