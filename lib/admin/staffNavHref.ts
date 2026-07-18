/** Ссылки staff-панели с сохранением ?site= (и прочих query params). */
export function staffNavHref(path: string, siteSlug: "gpt-store" | "subs-store"): string {
  const [base, existing = ""] = path.split("?");
  const q = new URLSearchParams(existing);
  if (!q.has("site")) q.set("site", siteSlug);
  const qs = q.toString();
  return qs ? `${base}?${qs}` : (base ?? path);
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
