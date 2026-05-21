"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSiteBySlug } from "@/lib/sites";

interface BrandingProps {
  /** Optional server-resolved slug (from cookie). Falls back to URL ?site= param. */
  defaultSiteSlug?: string;
}

export function DashboardSiteLogo({ defaultSiteSlug }: BrandingProps) {
  const params = useSearchParams();
  const siteSlug = params.get("site") ?? defaultSiteSlug ?? null;
  const site = getSiteBySlug(siteSlug);

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
  const params = useSearchParams();
  const siteSlug = params.get("site") ?? defaultSiteSlug ?? null;
  const site = getSiteBySlug(siteSlug);
  const isSubs = site.slug === "subs-store";
  return (
    <span className={`font-heading text-sm font-semibold ${isSubs ? "text-white" : "text-gray-900"}`}>
      {site.brandName}
    </span>
  );
}
