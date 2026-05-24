/** Ссылки staff-панели с сохранением ?site= */
export function staffNavHref(path: string, siteSlug: "gpt-store" | "subs-store"): string {
  const base = path.split("?")[0] ?? path;
  const sep = path.includes("?") ? "&" : "?";
  if (path.includes("site=")) return path;
  return `${base}${sep}site=${encodeURIComponent(siteSlug)}`;
}

export function staffNotificationsHref(
  siteSlug: "gpt-store" | "subs-store",
  base: "/admin/notifications" | "/operator/notifications" = "/admin/notifications",
): string {
  return staffNavHref(base, siteSlug);
}

/** Фильтр статусов на странице заказов — относительный URL, чтобы оператор оставался на /operator/orders. */
export function staffOrdersStatusHref(
  siteSlug: "gpt-store" | "subs-store",
  status?: string,
): string {
  const params = new URLSearchParams();
  params.set("site", siteSlug);
  if (status) params.set("status", status);
  return `?${params.toString()}`;
}
