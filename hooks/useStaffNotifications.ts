"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { StaffPanelRoot } from "@/lib/admin/notificationNavigation";
import { siteSlugFromAlertSiteId } from "@/lib/admin/notificationNavigation";
import { debounceCallback } from "@/lib/admin/debounce-callback";
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

const POLL_MS = 30_000;
const REALTIME_DEBOUNCE_MS = 600;

function notificationsApiForSites(sites: SiteSlug[]): Array<{ url: string; site: SiteSlug }> {
  const unique = [...new Set(sites)];
  return unique.map((s) => {
    if (s === "subs-store") {
      return { url: "/api/admin/subs-store/notifications", site: "subs-store" as const };
    }
    return { url: "/api/admin/notifications?site=gpt-store", site: "gpt-store" as const };
  });
}

function normalizeAccessibleSites(raw: string[] | null | undefined): SiteSlug[] {
  const out = (raw ?? []).filter((s): s is SiteSlug => s === "gpt-store" || s === "subs-store");
  return out.length ? out : ["gpt-store"];
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
  const { staffRoot, soundEnabled, soundVolume } = params;
  const [items, setItems] = useState<StaffNotificationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accessibleSites, setAccessibleSites] = useState<SiteSlug[]>(["gpt-store"]);
  const bootRef = useRef(true);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const markingAllRef = useRef(false);
  const accessibleSitesRef = useRef<SiteSlug[]>(accessibleSites);
  const channelSuffix = useId().replace(/:/g, "");

  accessibleSitesRef.current = accessibleSites;

  useEffect(() => {
    markingAllRef.current = markingAll;
  }, [markingAll]);

  const gptSupabase = useMemo(() => tryCreateClient(), []);
  const subsSupabase = useMemo(() => tryCreateSubsBrowserClient(), []);

  const accessibleSitesKey = useMemo(
    () => [...accessibleSites].sort().join(","),
    [accessibleSites],
  );

  const reload = useCallback(async () => {
    const sites = accessibleSitesRef.current;
    if (!sites.length) return;

    try {
      const responses = await Promise.all(
        notificationsApiForSites(sites).map(async ({ url, site }) => {
          const res = await fetch(url, { credentials: "include", cache: "no-store" });
          const data = (await res.json().catch(() => ({}))) as { items?: ApiItem[]; error?: string };
          return { url, site, res, data };
        }),
      );

      const hasErrors = responses.some(({ res }) => !res.ok);
      setLoadError(hasErrors ? "Не удалось загрузить часть уведомлений" : null);
      const merged: ApiItem[] = [];
      for (const { site, data } of responses) {
        for (const row of data.items ?? []) {
          merged.push({ ...row, site_id: site });
        }
      }
      const rows = merged.map((row) =>
        safeMapStaffNotificationRow(row, (row.site_id as SiteSlug) ?? "gpt-store", staffRoot),
      );

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
  }, [staffRoot, soundEnabled, soundVolume]);

  const debouncedReload = useMemo(
    () => debounceCallback(() => void reload(), REALTIME_DEBOUNCE_MS),
    [reload],
  );

  useEffect(() => () => debouncedReload.cancel(), [debouncedReload]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/accessible-admin-sites", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((j: { sites?: string[] }) => {
        if (cancelled) return;
        setAccessibleSites(normalizeAccessibleSites(j.sites ?? null));
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
  }, [staffRoot]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload, accessibleSitesKey]);

  useEffect(() => {
    if (markingAll) return;
    const poll = window.setInterval(() => void reload(), POLL_MS);
    return () => window.clearInterval(poll);
  }, [reload, markingAll]);

  useEffect(() => {
    const scheduleReload = () => {
      if (markingAllRef.current) return;
      debouncedReload();
    };

    const channels: Array<{ client: unknown; channel: unknown }> = [];
    if (gptSupabase && accessibleSites.includes("gpt-store")) {
      try {
        const gptChannel = gptSupabase
          .channel(`staff-notifications-gpt-${staffRoot}-${channelSuffix}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "notifications" },
            scheduleReload,
          )
          .subscribe();
        channels.push({ client: gptSupabase, channel: gptChannel });
      } catch {
        /* noop */
      }
    }
    if (subsSupabase && accessibleSites.includes("subs-store")) {
      try {
        const subsChannel = subsSupabase
          .channel(`staff-notifications-subs-${staffRoot}-${channelSuffix}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "notifications" },
            scheduleReload,
          )
          .subscribe();
        channels.push({ client: subsSupabase, channel: subsChannel });
      } catch {
        /* noop */
      }
    }
    return () => {
      debouncedReload.cancel();
      for (const item of channels) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        void (item.client as any).removeChannel(item.channel as any);
      }
    };
  }, [accessibleSitesKey, gptSupabase, subsSupabase, staffRoot, debouncedReload, channelSuffix]);

  const unread = items.filter((i) => !i.is_read).length;

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [items]);

  const markRead = useCallback(async (id: string, site: SiteSlug = "gpt-store") => {
    const prev = items;
    setItems((current) =>
      current.map((x) =>
        x.id === id && (x.site_id ?? "gpt-store") === site ? { ...x, is_read: true } : x,
      ),
    );
    const res = await fetch(
      site === "subs-store" ? "/api/admin/subs-store/notifications" : "/api/admin/notifications",
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          site === "subs-store" ? { id } : { id, site: "gpt-store" },
        ),
        cache: "no-store",
      },
    );
    if (!res.ok) {
      setItems(prev);
      setLoadError("Не удалось отметить уведомление");
      return;
    }
    knownIdsRef.current.add(`${site}:${id}`);
    refreshStaffNavBadges();
  }, [items]);

  const markAllRead = useCallback(async () => {
    if (markingAllRef.current) return;
    const sites = accessibleSitesRef.current;
    if (!sites.length) return;

    const snapshot = items;
    const hadUnread = snapshot.some((x) => !x.is_read);
    markingAllRef.current = true;
    setMarkingAll(true);
    debouncedReload.cancel();
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));

    try {
      const responses = await Promise.all(
        notificationsApiForSites(sites).map(async ({ site }) => {
          const res = await fetch(
            site === "subs-store"
              ? "/api/admin/subs-store/notifications"
              : "/api/admin/notifications",
            {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                site === "subs-store"
                  ? { mark_all: true }
                  : { mark_all: true, site: "gpt-store" },
              ),
              cache: "no-store",
            },
          );
          const data = (await res.json().catch(() => ({}))) as {
            ok?: boolean;
            marked?: number;
            error?: string;
          };
          return { site, res, data };
        }),
      );

      const failed = responses.filter(({ res }) => !res.ok);
      const succeeded = responses.filter(({ res }) => res.ok);
      const totalMarked = succeeded.reduce((sum, { data }) => sum + (data.marked ?? 0), 0);

      if (failed.length === responses.length) {
        const errMsg = failed[0]?.data.error ?? "Не удалось отметить уведомления";
        setLoadError(errMsg);
        setItems(snapshot);
        return;
      }

      if (failed.length > 0) {
        setLoadError("Часть уведомлений не обновилась — нажмите ещё раз");
      } else if (hadUnread && totalMarked === 0) {
        setLoadError("Не удалось сохранить прочитанное — обновите страницу и повторите");
        setItems(snapshot);
        return;
      } else {
        setLoadError(null);
      }

      for (const row of snapshot) {
        knownIdsRef.current.add(`${row.site_id ?? "gpt-store"}:${row.id}`);
      }
      setItems((current) => current.map((x) => ({ ...x, is_read: true })));
      refreshStaffNavBadges();
    } catch {
      setLoadError("Не удалось отметить уведомления");
      setItems(snapshot);
    } finally {
      markingAllRef.current = false;
      setMarkingAll(false);
      void reload();
      refreshStaffNavBadges();
    }
  }, [items, reload, debouncedReload]);

  return {
    items: sortedItems,
    unread,
    loading,
    markingAll,
    loadError,
    reload,
    markRead,
    markAllRead,
    accessibleSites,
    siteSlugFromRow: (row: StaffNotificationView) =>
      siteSlugFromAlertSiteId(row.site_id ?? "gpt-store"),
  };
}
