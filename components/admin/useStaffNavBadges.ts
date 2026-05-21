"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { STAFF_NAV_BADGES_REFRESH } from "@/lib/admin/staff-nav-badges-client";

export type StaffNavBadges = {
  notifications: number;
  chat: number;
  orders: number;
};

const EMPTY: StaffNavBadges = { notifications: 0, chat: 0, orders: 0 };

const POLL_MS = 5000;

export function useStaffNavBadges(siteSlug: "gpt-store" | "subs-store"): StaffNavBadges {
  const [badges, setBadges] = useState<StaffNavBadges>(EMPTY);
  const supabase = useMemo(() => createClient(), []);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/staff-nav-badges?site=${siteSlug}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const j = (await res.json()) as StaffNavBadges;
      setBadges({
        notifications: Number(j.notifications) || 0,
        chat: Number(j.chat) || 0,
        orders: Number(j.orders) || 0,
      });
    } catch {
      /* noop */
    }
  }, [siteSlug]);

  useEffect(() => {
    void reload();
    const onRefresh = () => void reload();
    window.addEventListener(STAFF_NAV_BADGES_REFRESH, onRefresh);
    const t = window.setInterval(() => void reload(), POLL_MS);
    return () => {
      window.removeEventListener(STAFF_NAV_BADGES_REFRESH, onRefresh);
      window.clearInterval(t);
    };
  }, [reload]);

  useEffect(() => {
    if (siteSlug !== "gpt-store") return;

    const channel = supabase
      .channel(`staff-nav-badges-${siteSlug}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages" },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        () => void reload(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [siteSlug, supabase, reload]);

  return badges;
}
