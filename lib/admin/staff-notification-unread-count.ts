import type { SupabaseClient } from "@supabase/supabase-js";

import { countStaffUnreadNotifications } from "@/lib/admin/staff-notification-reads";
import type { UserRole } from "@/types/database";

/** Непрочитанные staff-уведомления для текущего пользователя (site-aware, без chat_reply). */
export async function countGptStoreUnreadNotifications(
  admin: SupabaseClient,
  params: {
    userId: string;
    role: UserRole;
    siteSlug?: "gpt-store" | "subs-store";
    email?: string | null;
  },
): Promise<number> {
  return countStaffUnreadNotifications(admin, {
    userId: params.userId,
    role: params.role,
    siteSlug: params.siteSlug ?? "gpt-store",
    email: params.email,
  });
}

export async function countSubsStoreUnreadNotifications(
  subs: SupabaseClient,
  params: {
    userId: string;
    role: UserRole;
    email?: string | null;
    sharedInboxUserId?: string | null;
  },
): Promise<number> {
  return countStaffUnreadNotifications(subs, {
    userId: params.userId,
    role: params.role,
    siteSlug: "subs-store",
    email: params.email,
    sharedInboxUserId: params.sharedInboxUserId,
  });
}
