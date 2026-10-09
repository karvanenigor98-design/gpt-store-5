"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getOrdersLastSeenAt } from "@/lib/admin/orders-last-seen";
import { STAFF_NAV_BADGES_REFRESH } from "@/lib/admin/staff-nav-badges-client";

export type StaffNavBadges = {
  notifications: number;
  chat: number;
  orders: number;
  reviews: number;
};

const EMPTY: StaffNavBadges = { notifications: 0, chat: 0, orders: 0, reviews: 0 };

const POLL_MS = 60_000;

export function useStaffNavBadges(siteSlug: "gpt-store" | "subs-store"): StaffNavBadges {
  const [badges, setBadges] = useState<StaffNavBadges>(EMPTY);
  const inFlightRef = useRef(false);

  const reload = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const since = getOrdersLastSeenAt(siteSlug);
      const qs = new URLSearchParams({ site: siteSlug });
      if (since) qs.set("ordersSince", since);
      const res = await fetch(`/api/admin/staff-nav-badges?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const j = (await res.json()) as StaffNavBadges;
      setBadges({
        notifications: Number(j.notifications) || 0,
        chat: Number(j.chat) || 0,
        orders: Number(j.orders) || 0,
        reviews: Number((j as StaffNavBadges).reviews) || 0,
      });
    } catch {
      /* noop */
    } finally {
      inFlightRef.current = false;
    }
  }, [siteSlug]);

  useEffect(() => {
    void reload();
    const onRefresh = () => void reload();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void reload();
    };
    window.addEventListener(STAFF_NAV_BADGES_REFRESH, onRefresh);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, POLL_MS);
    return () => {
      window.removeEventListener(STAFF_NAV_BADGES_REFRESH, onRefresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(t);
    };
  }, [reload]);

  /* Realtime supabase.co из РФ вешает UI — badges через poll /api. */

  return badges;
}
