"use client";

import { useEffect } from "react";
import { setOrdersLastSeenNow, type StaffOrdersSite } from "@/lib/admin/orders-last-seen";
import { refreshStaffNavBadges } from "@/lib/admin/staff-nav-badges-client";

export function MarkOrdersSeenOnVisit({ site }: { site: StaffOrdersSite }) {
  useEffect(() => {
    setOrdersLastSeenNow(site);
    refreshStaffNavBadges();
  }, [site]);
  return null;
}
