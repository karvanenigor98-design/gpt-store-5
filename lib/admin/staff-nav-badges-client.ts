/** Сброс счётчиков в сайдбаре после просмотра чата / уведомлений / заказов. */

export const STAFF_NAV_BADGES_REFRESH = "staff-nav-badges-refresh";

export function refreshStaffNavBadges(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STAFF_NAV_BADGES_REFRESH));
}
