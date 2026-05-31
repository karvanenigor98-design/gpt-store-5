"use client";

import Link from "next/link";
import { getSiteBySlug, type SiteSlug } from "@/lib/sites";

interface BrandingProps {
  /** Server-resolved slug (from cookie). */
  defaultSiteSlug: SiteSlug;
}

export function DashboardSiteLogo({ defaultSiteSlug }: BrandingProps) {
  const site = getSiteBySlug(defaultSiteSlug);

  return (
    <Link href={site.landingPath} className="flex items-center gap-2">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
        style={{ backgroundColor: site.primaryColor }}
      >
        {site.logoLetter}
      </div>
      <span className="font-heading text-sm font-bold text-white">{site.brandName}</span>
    </Link>
  );
}

export function DashboardSiteHeaderTitle({ defaultSiteSlug }: BrandingProps) {
  const site = getSiteBySlug(defaultSiteSlug);
  const isSubs = site.slug === "subs-store";
  return (
    <span className={`font-heading text-sm font-semibold ${isSubs ? "text-white" : "text-gray-900"}`}>
      {site.brandName}
    </span>
  );
}
