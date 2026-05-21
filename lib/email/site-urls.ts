import type { SiteSlug } from "@/lib/sites";
import { getSiteBySlug } from "@/lib/sites";

/** Базовый URL приложения для ссылок в письмах (без trailing slash). */
export function resolveAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "http://localhost:3000";
  if (raw.startsWith("http")) return raw.replace(/\/$/, "");
  return `https://${raw.replace(/\/$/, "")}`;
}

/** Публичный URL лендинга/кабинета по сайту (env приоритетнее APP_URL для multi-domain). */
export function resolveSitePublicUrl(siteSlug: SiteSlug): string {
  if (siteSlug === "subs-store") {
    const subs = process.env.NEXT_PUBLIC_SUBS_STORE_URL?.trim();
    if (subs) return subs.replace(/\/$/, "");
  }
  if (siteSlug === "gpt-store") {
    const gpt = process.env.NEXT_PUBLIC_GPT_STORE_URL?.trim();
    if (gpt) return gpt.replace(/\/$/, "");
  }
  const app = resolveAppBaseUrl();
  const site = getSiteBySlug(siteSlug);
  if (siteSlug === "subs-store") {
    return `${app}${site.landingPath.startsWith("/") ? site.landingPath : `/${site.landingPath}`}`.replace(
      /\/spotify\/?$/,
      "",
    );
  }
  return app;
}

export function buildCustomerChatUrl(siteSlug: SiteSlug, sessionOrThreadId: string): string {
  const base = resolveSitePublicUrl(siteSlug);
  if (siteSlug === "subs-store") {
    return `${base}/dashboard/chat?site=subs-store&thread_id=${encodeURIComponent(sessionOrThreadId)}`;
  }
  return `${base}/dashboard/chat?session_id=${encodeURIComponent(sessionOrThreadId)}`;
}

export function buildCustomerOrderUrl(siteSlug: SiteSlug, orderId: string): string {
  const base = resolveSitePublicUrl(siteSlug);
  if (siteSlug === "subs-store") {
    return `${base}/dashboard/orders?site=subs-store&order_id=${encodeURIComponent(orderId)}`;
  }
  return `${base}/dashboard/orders?order_id=${encodeURIComponent(orderId)}`;
}

export function buildReviewUrl(siteSlug: SiteSlug): string {
  const base = resolveSitePublicUrl(siteSlug);
  if (siteSlug === "subs-store") {
    return `${base}/reviews?site=subs-store`;
  }
  return `${base}/reviews`;
}

export function buildStaffChatUrl(siteSlug: SiteSlug, sessionOrThreadId: string): string {
  const app = resolveAppBaseUrl();
  if (siteSlug === "subs-store") {
    return `${app}/operator/chat?site=subs-store&thread_id=${encodeURIComponent(sessionOrThreadId)}`;
  }
  return `${app}/operator/chat?site=gpt-store&session_id=${encodeURIComponent(sessionOrThreadId)}`;
}

export function buildStaffOrderUrl(siteSlug: SiteSlug, orderId?: string): string {
  const app = resolveAppBaseUrl();
  const q = `site=${siteSlug}${orderId ? `&highlight=${encodeURIComponent(orderId)}` : ""}`;
  return `${app}/admin/orders?${q}`;
}
