"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import {
  useClientNotifications,
  type ClientNotificationsState,
} from "@/hooks/useClientNotifications";

const ClientNotificationsContext = createContext<ClientNotificationsState | null>(null);

export function ClientNotificationsProvider({
  siteSlug,
  children,
}: {
  siteSlug: SiteSlug;
  children: ReactNode;
}) {
  const value = useClientNotifications(siteSlug);
  return (
    <ClientNotificationsContext.Provider value={value}>
      {children}
    </ClientNotificationsContext.Provider>
  );
}

export function useClientNotificationsContext(): ClientNotificationsState {
  const ctx = useContext(ClientNotificationsContext);
  if (!ctx) {
    throw new Error("useClientNotificationsContext must be used within ClientNotificationsProvider");
  }
  return ctx;
}
