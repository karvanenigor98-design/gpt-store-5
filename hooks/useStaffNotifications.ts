"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { StaffPanelRoot } from "@/lib/admin/notificationNavigation";
import { siteSlugFromAlertSiteId } from "@/lib/admin/notificationNavigation";
import { safeMapStaffNotificationRow } from "@/lib/notifications/safe-map-staff-row";
import { playNotificationPing } from "@/lib/admin/notification-sound";
import { refreshStaffNavBadges } from "@/lib/admin/staff-nav-badges-client";
import {
  showStaffNotificationToast,
  type StaffToastPayload,
} from "@/lib/notifications/staff-notification-toast";
import { tryCreateClient } from "@/lib/supabase/client";
import { tryCreateSubsBrowserClient } from "@/lib/supabase/subs-browser-client";

export type StaffNotificationRow = {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  entity_type: string | null;
  entity_id: string | null;
  type?: string;
  site_id?: string | null;
};

export type StaffNotificationView = StaffNotificationRow & {
  href: string;
};

type ApiItem = StaffNotificationRow;

type SiteSlug = "gpt-store" | "subs-store";

function notificationsApiForSite(
  site: SiteSlug,
  allowedSites: SiteSlug[],
): Array<{ url: string; site: SiteSlug }> {
  const sites = allowedSites.length ? allowedSites : [site];
  return sites.map((s) => {
    if (s === "subs-store") {
      return { url: "/api/admin/subs-store/notifications", site: "subs-store" as const };
    }
    return { url: "/api/admin/notifications?site=gpt-store", site: "gpt-store" as const };
  });
}

function uniqueSiteSlugs(rows: StaffNotificationView[]): SiteSlug[] {
  const out = new Set<SiteSlug>();
  for (const row of rows) {
    out.add((row.site_id === "subs-store" ? "subs-store" : "gpt-store") as SiteSlug);
  }
  return [...out];
}

function toToast(item: StaffNotificationView): StaffToastPayload {
  const sitePrefix = item.site_id === "subs-store" ? "SPOTIFY STORE" : "GPT STORE";
  return {
    id: item.id,
    title: `${sitePrefix} — ${item.title}`,
    body: (item.message ?? "").slice(0, 160),
    href: item.href,
    type: item.type ?? null,
    site_id: item.site_id ?? null,
  };
}

export function useStaffNotifications(params: {
  siteSlug: SiteSlug;
  staffRoot: StaffPanelRoot;
  soundEnabled: boolean;
  soundVolume: number;
}) {
  const { siteSlug, staffRoot, soundEnabled, soundVolume } = params;
  const [items, setItems] = useState<StaffNotificationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accessibleSites, setAccessibleSites] = useState<SiteSlug[]>(["gpt-store"]);
  const bootRef = useRef(true);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const channelSuffix = useId().replace(/:/g, "");

  const gptSupabase = useMemo(() => tryCreateClient(), []);
  const subsSupabase = useMemo(() => tryCreateSubsBrowserClient(), []);

  const activeSites = useMemo(
    () => (accessibleSites.includes(siteSlug) ? [siteSlug] : accessibleSites),
    [accessibleSites, siteSlug],
  );

  const reload = useCallback(async () => {
    try {
      const responses = await Promise.all(
        notificationsApiForSite(siteSlug, accessibleSites).map(async ({ url, site }) => {
          const res = await fetch(url, { credentials: "include" });
          const data = (await res.json().catch(() => ({}))) as { items?: ApiItem[]; error?: string };
          return { url, site, res, data };
        }),
      );

      const hasErrors = responses.some(({ res }) => !res.ok);
      setLoadError(hasErrors ? "Не удалось загрузить часть уведомлений" : null);
      const merged: ApiItem[] = [];
      for (const { site, data } of responses) {
        const sourceSite: SiteSlug = site;
        for (const row of data.items ?? []) {
          merged.push({ ...row, site_id: sourceSite });
        }
      }
      const rows = merged.map((row) => safeMapStaffNotificationRow(row, (row.site_id as "gpt-store" | "subs-store") ?? siteSlug, staffRoot));

      const isBoot = bootRef.current;
      if (!isBoot) {
        for (const row of rows) {
          const dedupeKey = `${row.site_id ?? "gpt-store"}:${row.id}`;
          if (row.is_read || knownIdsRef.current.has(dedupeKey)) continue;
          knownIdsRef.current.add(dedupeKey);
          try {
            if (soundEnabled) playNotificationPing({ volume: soundVolume });
            showStaffNotificationToast(toToast(row), staffRoot);
            refreshStaffNavBadges();
          } catch {
            /* toast/sound не должны ронять UI */
          }
        }
      } else {
        for (const row of rows) knownIdsRef.current.add(`${row.site_id ?? "gpt-store"}:${row.id}`);
        bootRef.current = false;
      }

      rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setItems(rows);
    } catch {
      setLoadError("Не удалось загрузить уведомления");
    } finally {
      setLoading(false);
    }
  }, [accessibleSites, siteSlug, staffRoot, soundEnabled, soundVolume]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/accessible-admin-sites", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { sites?: string[] }) => {
        if (cancelled) return;
        const raw = Array.isArray(j.sites) ? j.sites : [];
        const next = raw.filter((s): s is SiteSlug => s === "gpt-store" || s === "subs-store");
        setAccessibleSites(next.length ? next : ["gpt-store"]);
      })
      .catch(() => {
        if (!cancelled) setAccessibleSites(["gpt-store"]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bootRef.current = true;
    knownIdsRef.current = new Set();
    setLoading(true);
    void reload();
  }, [reload]);

  useEffect(() => {
    if (markingAll) return;
    const poll = window.setInterval(() => void reload(), 15_000);
    return () => window.clearInterval(poll);
  }, [reload, markingAll]);

  useEffect(() => {
    const channels: Array<{ client: unknown; channel: unknown }> = [];
    if (gptSupabase && accessibleSites.includes("gpt-store")) {
      try {
        const gptChannel = gptSupabase
          .channel(`staff-notifications-gpt-${staffRoot}-${channelSuffix}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => void reload())
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => void reload())
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => void reload())
          .subscribe();
        channels.push({ client: gptSupabase, channel: gptChannel });
      } catch {}
    }
    if (subsSupabase && accessibleSites.includes("subs-store")) {
      try {
        const subsChannel = subsSupabase
          .channel(`staff-notifications-subs-${staffRoot}-${channelSuffix}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => void reload())
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => void reload())
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => void reload())
          .subscribe();
        channels.push({ client: subsSupabase, channel: subsChannel });
      } catch {}
    }
    return () => {
      for (const item of channels) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        void (item.client as any).removeChannel(item.channel as any);
      }
    };
  }, [accessibleSites, gptSupabase, subsSupabase, staffRoot, reload, channelSuffix]);

  const unread = items.filter((i) => !i.is_read).length;

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [items]);

  const markRead = useCallback(
    async (id: string, site: SiteSlug = "gpt-store") => {
      setItems((prev) =>
        prev.map((x) =>
          x.id === id && (x.site_id ?? "gpt-store") === site
            ? { ...x, is_read: true }
            : x,
        ),
      );
      if (site === "subs-store") {
        await fetch("/api/admin/subs-store/notifications", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      } else {
        await fetch("/api/admin/notifications", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, site: "gpt-store" }),
        });
      }
      refreshStaffNavBadges();
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    if (markingAll) return;
    if (!activeSites.length) return;
    const snapshot = items;
    setMarkingAll(true);
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));

    try {
      const fromItems = uniqueSiteSlugs(snapshot).filter((s) => accessibleSites.includes(s));
      const targetSites = fromItems.length ? fromItems : accessibleSites;
      const responses = await Promise.all(
        targetSites.map((targetSite) =>
          fetch(
            targetSite === "subs-store"
              ? "/api/admin/subs-store/notifications"
              : "/api/admin/notifications",
            {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                targetSite === "subs-store"
                  ? { mark_all: true }
                  : { mark_all: true, site: "gpt-store" },
              ),
            },
          ),
        ),
      );

      const failed = responses.find((r) => !r.ok);
      if (failed) {
        const data = (await failed.json().catch(() => ({}))) as { error?: string };
        setLoadError(data.error ?? "Не удалось отметить уведомления");
        setItems(snapshot);
        return;
      }

      setLoadError(null);
      refreshStaffNavBadges();
    } catch {
      setLoadError("Не удалось отметить уведомления");
      setItems(snapshot);
    } finally {
      await reload();
      refreshStaffNavBadges();
      setMarkingAll(false);
    }
  }, [accessibleSites, items, markingAll, reload]);

  return {
    items: sortedItems,
    unread,
    loading,
    markingAll,
    loadError,
    reload,
    markRead,
    markAllRead,
    siteSlugFromRow: (row: StaffNotificationView) =>
      siteSlugFromAlertSiteId(row.site_id ?? siteSlug),
  };
}
