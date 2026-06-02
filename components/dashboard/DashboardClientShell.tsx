"use client";

import type { ReactNode } from "react";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { ClientNotificationsProvider } from "./ClientNotificationsContext";

export function DashboardClientShell({
  siteSlug,
  children,
}: {
  siteSlug: SiteSlug;
  children: ReactNode;
}) {
  return <ClientNotificationsProvider siteSlug={siteSlug}>{children}</ClientNotificationsProvider>;
}
