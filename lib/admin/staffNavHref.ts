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
