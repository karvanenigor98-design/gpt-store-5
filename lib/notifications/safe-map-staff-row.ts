import type { StaffPanelRoot } from "@/lib/admin/notificationNavigation";
import { buildAdminNotificationHref } from "@/lib/admin/notificationNavigation";

export type StaffNotificationRowInput = {
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

export type StaffNotificationViewOutput = StaffNotificationRowInput & { href: string };

export function safeMapStaffNotificationRow(
  row: StaffNotificationRowInput,
  siteSlug: "gpt-store" | "subs-store",
  staffRoot: StaffPanelRoot,
): StaffNotificationViewOutput {
  try {
    return {
      ...row,
      title: row.title ?? "Уведомление",
      message: row.message ?? "",
      href: buildAdminNotificationHref(
        {
          siteSlug,
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          type: row.type ?? null,
        },
        staffRoot,
      ),
    };
  } catch {
    return {
      ...row,
      title: row.title ?? "Уведомление",
      message: row.message ?? "",
      href: `${staffRoot}/notifications?site=${siteSlug}`,
    };
  }
}
