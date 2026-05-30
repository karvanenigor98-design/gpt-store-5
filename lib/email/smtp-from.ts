import type { SiteSlug } from "@/lib/sites";
import { getSiteBySlug } from "@/lib/sites";

function extractEmailAddress(raw: string): string {
  const m = raw.match(/<([^>]+)>/);
  return (m?.[1] ?? raw).trim();
}

/** Mail.ru / Yandex: From должен совпадать с SMTP_USER, иначе 550. */
export function resolveSmtpFromAddress(siteSlug?: SiteSlug): string {
  const user = process.env.SMTP_USER?.trim() ?? "";
  const host = (process.env.SMTP_HOST ?? "").toLowerCase();
  const fromEnv = process.env.SMTP_FROM_EMAIL?.trim() ?? "";

  const isMailRu =
    host.includes("mail.ru") ||
    /@(mail|bk|inbox|list)\.ru$/i.test(user) ||
    /@(mail|bk|inbox|list)\.ru$/i.test(fromEnv);

  if (isMailRu && user) {
    const brand = siteSlug
      ? getSiteBySlug(siteSlug).brandName
      : (process.env.SMTP_FROM_NAME?.trim() || "GPT STORE");
    return `${brand} <${extractEmailAddress(user)}>`;
  }

  const rawFrom = fromEnv || user;
  if (!rawFrom) return process.env.SMTP_FROM_NAME?.trim() || "GPT STORE";

  const emailOnly = extractEmailAddress(rawFrom);
  const brand = siteSlug
    ? getSiteBySlug(siteSlug).brandName
    : (process.env.SMTP_FROM_NAME?.trim() || "GPT STORE");
  return `${brand} <${emailOnly}>`;
}
