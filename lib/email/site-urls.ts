import { getPublicSiteOrigin } from "@/lib/app-url";
import type { SiteSlug } from "@/lib/sites";
import { getSiteBySlug } from "@/lib/sites";
import { getGptStoreLandingUrl, getSubsStoreLandingUrl } from "@/lib/store-urls";

/** Базовый URL приложения для ссылок в письмах (без trailing slash). */
export function resolveAppBaseUrl(): string {
  return getPublicSiteOrigin();
}

/** Публичный URL лендинга/кабинета по сайту (env приоритетнее APP_URL для multi-domain). */
export function resolveSitePublicUrl(siteSlug: SiteSlug): string {
  if (siteSlug === "subs-store") return getSubsStoreLandingUrl();
  if (siteSlug === "gpt-store") return getGptStoreLandingUrl();
  const app = resolveAppBaseUrl();
  const site = getSiteBySlug(siteSlug);
  return `${app}${site.landingPath.startsWith("/") ? site.landingPath : `/${site.landingPath}`}`;
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
