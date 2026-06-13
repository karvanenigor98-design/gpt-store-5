"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { resolveStaffSiteSlug } from "@/lib/admin/resolveStaffSiteSlug";
import { getAdminSelectedSiteSlug } from "@/components/admin/SiteSwitcher";

/** Ensures staff routes always carry ?site= so server pages load the correct store. */
export function StaffSiteUrlSync() {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname.startsWith("/admin") && !pathname.startsWith("/operator")) return;

    const urlSite = sp.get("site");
    if (urlSite === "gpt-store" || urlSite === "subs-store") return;

    const saved = getAdminSelectedSiteSlug();
    const site = resolveStaffSiteSlug(sp, saved);
    const q = new URLSearchParams(sp.toString());
    q.set("site", site);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [sp, pathname, router]);

  return null;
}
