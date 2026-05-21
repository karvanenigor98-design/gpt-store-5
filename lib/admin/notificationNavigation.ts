/**
 * Куда вести админа при клике на уведомление (колокол / страница уведомлений).
 */

export type AdminNotificationSiteSlug = "gpt-store" | "subs-store";

export function siteSlugFromAlertSiteId(siteId?: string | null): AdminNotificationSiteSlug {
  if (siteId === "subs-store") return "subs-store";
  return "gpt-store";
}

export type StaffPanelRoot = "/admin" | "/operator";

export function staffPanelRootFromPathname(pathname: string | null | undefined): StaffPanelRoot {
  return pathname?.startsWith("/operator") ? "/operator" : "/admin";
}

export function buildAdminNotificationHref(
  params: {
    siteSlug: AdminNotificationSiteSlug;
    entity_type?: string | null;
    entity_id?: string | null;
    type?: string | null;
  },
  staffRoot: StaffPanelRoot = "/admin",
): string {
  const { siteSlug, entity_type, entity_id, type } = params;
  const q = new URLSearchParams({ site: siteSlug });
  const eid = entity_id?.trim() ?? "";
  const et = (entity_type ?? "").toLowerCase();

  if ((et === "chat_session" || et === "chat_thread") && eid) {
    if (siteSlug === "subs-store") {
      q.set("thread_id", eid);
    } else {
      q.set("session_id", eid);
    }
    return `${staffRoot}/chat?${q.toString()}`;
  }

  if ((et === "order" || type === "new_order" || type === "payment_success" || type === "payment_failed" || type === "order_problem" || type === "order_activated" || type === "order_needs_data") && eid) {
    q.set("highlight", eid);
    return `${staffRoot}/orders?${q.toString()}`;
  }

  if (type === "new_review" || et === "review") {
    if (eid) q.set("highlight", eid);
    if (staffRoot === "/operator") {
      return `${staffRoot}?${q.toString()}`;
    }
    return `${staffRoot}/reviews?${q.toString()}`;
  }

  if (type === "new_chat_message") {
    if (eid) {
      if (siteSlug === "subs-store") q.set("thread_id", eid);
      else q.set("session_id", eid);
    }
    return `${staffRoot}/chat?${q.toString()}`;
  }

  const notifPath = staffRoot === "/operator" ? staffRoot : `${staffRoot}/notifications`;
  return `${notifPath}?${q.toString()}`;
}

/** Сохранить выбранный магазин перед переходом по ссылке из уведомления. */
export function persistAdminSiteBeforeNavigate(siteSlug: AdminNotificationSiteSlug): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("admin-selected-site-slug", siteSlug);
    document.cookie = `current_site=${siteSlug}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  } catch {
    /* noop */
  }
}
