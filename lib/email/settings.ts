import { createAdminClient } from "@/lib/supabase/server";
import type { SiteSlug } from "@/lib/sites";

import type { EmailSettingsCategory } from "@/lib/email/events";

export type SiteEmailNotificationSettings = {
  enabled_clients: boolean;
  enabled_admins: boolean;
  enabled_operators: boolean;
  enabled_chat: boolean;
  enabled_orders: boolean;
  enabled_reviews: boolean;
  enabled_payments: boolean;
  enabled_promocodes: boolean;
};

const DEFAULTS: SiteEmailNotificationSettings = {
  enabled_clients: true,
  enabled_admins: true,
  enabled_operators: true,
  enabled_chat: true,
  enabled_orders: true,
  enabled_reviews: true,
  enabled_payments: true,
  enabled_promocodes: true,
};

const cache = new Map<string, { at: number; value: SiteEmailNotificationSettings }>();
const CACHE_MS = 30_000;

function mergeSettings(raw: unknown): SiteEmailNotificationSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULTS };
  const o = raw as Record<string, unknown>;
  return {
    enabled_clients: o.enabled_clients !== false,
    enabled_admins: o.enabled_admins !== false,
    enabled_operators: o.enabled_operators !== false,
    enabled_chat: o.enabled_chat !== false,
    enabled_orders: o.enabled_orders !== false,
    enabled_reviews: o.enabled_reviews !== false,
    enabled_payments: o.enabled_payments !== false,
    enabled_promocodes: o.enabled_promocodes !== false,
  };
}

export async function getSiteEmailSettings(
  siteSlug: SiteSlug,
): Promise<SiteEmailNotificationSettings> {
  const hit = cache.get(siteSlug);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("email_notification_settings")
      .select("settings")
      .eq("site_slug", siteSlug)
      .maybeSingle();

    const value = mergeSettings(data?.settings);
    cache.set(siteSlug, { at: Date.now(), value });
    return value;
  } catch {
    return { ...DEFAULTS };
  }
}

export function invalidateSiteEmailSettingsCache(siteSlug?: string): void {
  if (siteSlug) cache.delete(siteSlug);
  else cache.clear();
}

export async function saveSiteEmailSettings(
  siteSlug: SiteSlug,
  settings: SiteEmailNotificationSettings,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("email_notification_settings").upsert({
      site_slug: siteSlug,
      settings,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    invalidateSiteEmailSettingsCache(siteSlug);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "save_failed",
    };
  }
}

export function isRecipientRoleEnabled(
  settings: SiteEmailNotificationSettings,
  role: "client" | "admin" | "operator" | "staff",
): boolean {
  if (role === "client") return settings.enabled_clients;
  if (role === "admin") return settings.enabled_admins;
  if (role === "operator") return settings.enabled_operators;
  return settings.enabled_admins || settings.enabled_operators;
}

export function isCategoryEnabled(
  settings: SiteEmailNotificationSettings,
  category: EmailSettingsCategory,
): boolean {
  switch (category) {
    case "chat":
      return settings.enabled_chat;
    case "orders":
      return settings.enabled_orders;
    case "payments":
      return settings.enabled_payments;
    case "reviews":
      return settings.enabled_reviews;
    case "promocodes":
      return settings.enabled_promocodes;
    default:
      return true;
  }
}
