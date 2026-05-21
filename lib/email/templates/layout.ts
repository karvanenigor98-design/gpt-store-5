import type { SiteSlug } from "@/lib/sites";
import { getSiteBySlug } from "@/lib/sites";

export type BrandedEmailContent = {
  subject: string;
  text: string;
  html: string;
};

type BuildParams = {
  siteSlug: SiteSlug;
  title: string;
  bodyLines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
};

function theme(siteSlug: SiteSlug) {
  const site = getSiteBySlug(siteSlug);
  const isSubs = siteSlug === "subs-store";
  return {
    brand: site.brandName,
    primary: site.primaryColor,
    bg: isSubs ? "#0a0a0a" : "#f7f7f8",
    card: isSubs ? "#121212" : "#ffffff",
    text: isSubs ? "#e8e8e8" : "#1a1a1a",
    muted: isSubs ? "#9ca3af" : "#6b7280",
    btnText: isSubs ? "#000000" : "#ffffff",
  };
}

export function buildBrandedEmail(params: BuildParams): BrandedEmailContent {
  const t = theme(params.siteSlug);
  const bodyText = params.bodyLines.join("\n\n");
  const ctaText =
    params.ctaLabel && params.ctaUrl
      ? `\n\n${params.ctaLabel}: ${params.ctaUrl}`
      : "";

  const text = `${params.title}\n\n${bodyText}${ctaText}\n\n— ${t.brand}`;

  const bodyHtml = params.bodyLines
    .map((line) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${t.text}">${escapeHtml(line)}</p>`)
    .join("");

  const ctaHtml =
    params.ctaLabel && params.ctaUrl
      ? `<p style="margin:24px 0 0"><a href="${escapeAttr(params.ctaUrl)}" style="display:inline-block;padding:12px 20px;background:${t.primary};color:${t.btnText};text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">${escapeHtml(params.ctaLabel)}</a></p>`
      : "";

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:${t.bg};font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="100%" style="max-width:520px;background:${t.card};border-radius:12px;padding:28px" cellpadding="0" cellspacing="0">
<tr><td>
<p style="margin:0 0 8px;font-size:12px;color:${t.muted};text-transform:uppercase;letter-spacing:0.05em">${escapeHtml(t.brand)}</p>
<h1 style="margin:0 0 16px;font-size:20px;color:${t.text}">${escapeHtml(params.title)}</h1>
${bodyHtml}
${ctaHtml}
<p style="margin:28px 0 0;font-size:12px;color:${t.muted}">Это системное письмо. Ответьте в личном кабинете или чате на сайте.</p>
</td></tr></table></td></tr></table></body></html>`;

  return {
    subject: `${params.title} — ${t.brand}`,
    text,
    html,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
