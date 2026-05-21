import type { Metadata } from "next";
import { cookies } from "next/headers";
import { cn } from "@/lib/utils";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { getSiteBySlug } from "@/lib/sites";
import { LandingReviewSubmitPanel } from "@/components/sections/LandingReviewSubmitPanel";

export const metadata: Metadata = { title: "Оставить отзыв" };

export default async function DashboardReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const rawSite = params.site ?? cookieStore.get("current_site")?.value;
  const siteSlug: SiteSlug = rawSite === "subs-store" ? "subs-store" : "gpt-store";
  const site = getSiteBySlug(siteSlug);
  const isSubs = siteSlug === "subs-store";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div>
        <h1 className={cn("font-heading text-2xl font-bold", isSubs ? "text-white" : "text-gray-900")}>
          Отзывы
        </h1>
        <p className={cn("mt-1 text-sm", isSubs ? "text-gray-400" : "text-gray-500")}>
          Напишите отзыв о {site.brandName} — он сразу попадёт администратору. После одобрения появится на
          сайте.
        </p>
      </div>

      <LandingReviewSubmitPanel siteSlug={siteSlug} embedded />
    </div>
  );
}
