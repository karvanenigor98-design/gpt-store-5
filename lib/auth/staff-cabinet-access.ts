import type { UserRole } from "@/types/database";

/** Staff открывает клиентский кабинет намеренно (?view=client). */
export function isStaffClientCabinetView(urlOrSearch: string): boolean {
  if (!urlOrSearch) return false;
  try {
    const q = urlOrSearch.includes("?") ? urlOrSearch.slice(urlOrSearch.indexOf("?")) : urlOrSearch;
    if (q.startsWith("?")) {
      return new URLSearchParams(q).get("view") === "client";
    }
    return /(?:\?|&)view=client(?:&|$)/.test(urlOrSearch);
  } catch {
    return urlOrSearch.includes("view=client");
  }
}

export function staffPanelHomeForRole(role: UserRole): "/admin" | "/operator" | null {
  if (role === "admin") return "/admin";
  if (role === "operator") return "/operator";
  return null;
}

export function isDashboardCabinetPath(pathname: string): boolean {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/cabinet");
}

/** Куда отправить staff с клиентского кабинета (если не view=client). */
export function resolveStaffAwayFromClientCabinet(
  role: UserRole,
  pathname: string,
  search = "",
): string | null {
  if (!isDashboardCabinetPath(pathname)) return null;
  if (isStaffClientCabinetView(search)) return null;

  const panel = staffPanelHomeForRole(role);
  if (!panel) return null;

  if (pathname.startsWith("/dashboard/chat") || pathname.startsWith("/cabinet/chat")) {
    const qs = search && search.startsWith("?") ? search : search ? `?${search}` : "";
    return `${panel}/chat${qs}`;
  }

  return panel;
}
