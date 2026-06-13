"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import {
  buildClientNotificationHref,
} from "@/lib/dashboard/client-notification-navigation";
import { playNotificationPing } from "@/lib/admin/notification-sound";
import { tryCreateClient } from "@/lib/supabase/client";
import { tryCreateSubsBrowserClient } from "@/lib/supabase/subs-browser-client";

export type ClientNotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
};

const API_BY_SITE: Record<SiteSlug, string> = {
  "gpt-store": "/api/gpt/notifications",
  "subs-store": "/api/subs/notifications",
};

export function useClientNotifications(siteSlug: SiteSlug) {
  const isSubs = siteSlug === "subs-store";
  const accent = isSubs ? "#1DB954" : "#10a37f";

  const [items, setItems] = useState<ClientNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const bootRef = useRef(true);
  const knownIdsRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch(API_BY_SITE[siteSlug], {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await res.json().catch(() => ({}))) as {
        items?: ClientNotificationItem[];
        error?: string;
      };
      if (!res.ok) {
        setLoadError(j.error ?? "Не удалось загрузить уведомления");
        return;
      }
      setLoadError(null);
      const rows = j.items ?? [];

      const isBoot = bootRef.current;
      if (!isBoot) {
        for (const row of rows) {
          if (row.is_read || knownIdsRef.current.has(row.id)) continue;
          knownIdsRef.current.add(row.id);
          try {
            playNotificationPing();
            const { showClientNotificationToast } = await import(
              "@/lib/notifications/client-notification-toast"
            );
            showClientNotificationToast({
              id: row.id,
              title: row.title,
              message: row.message,
              href: buildClientNotificationHref(siteSlug, row),
              accent,
            });
          } catch {
            /* noop */
          }
        }
      } else {
        for (const row of rows) knownIdsRef.current.add(row.id);
        bootRef.current = false;
      }

      setItems(rows);
    } catch {
      setLoadError("Не удалось загрузить уведомления");
    } finally {
      setLoading(false);
    }
  }, [siteSlug, accent]);

  useEffect(() => {
    bootRef.current = true;
    knownIdsRef.current = new Set();
    setLoading(true);
    void load();
    const t = window.setInterval(() => void load(), 12_000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    const supabase = siteSlug === "subs-store" ? tryCreateSubsBrowserClient() : tryCreateClient();
    if (!supabase) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`client-notifications-${siteSlug}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications" },
          () => void load(),
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "notifications" },
          () => void load(),
        )
        .subscribe();
    } catch {
      return;
    }

    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [siteSlug, load]);

  const displayItems = useMemo(
    () => [...items].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [items],
  );

  const unread = items.filter((i) => !i.is_read).length;

  const markRead = useCallback(
    async (id: string) => {
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, is_read: true } : x)));
      await fetch(API_BY_SITE[siteSlug], {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
    [siteSlug],
  );

  const markAllRead = useCallback(async () => {
    const snapshot = items;
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
    try {
      const res = await fetch(API_BY_SITE[siteSlug], {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all: true }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setLoadError(j.error ?? "Не удалось отметить все как прочитанные");
        setItems(snapshot);
        return;
      }
      setLoadError(null);
    } catch {
      setLoadError("Не удалось отметить все как прочитанные");
      setItems(snapshot);
    } finally {
      await load();
    }
  }, [siteSlug, load, items]);

  return {
    siteSlug,
    isSubs,
    accent,
    items: displayItems,
    unread,
    loading,
    loadError,
    reload: load,
    markRead,
    markAllRead,
  };
}

export type ClientNotificationsState = ReturnType<typeof useClientNotifications>;
