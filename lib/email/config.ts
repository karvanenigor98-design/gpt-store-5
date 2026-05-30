import type { SiteSlug } from "@/lib/sites";
import { getSiteBySlug } from "@/lib/sites";

export type EmailProvider = "smtp" | "resend" | "none";

export type EmailConfigStatus = {
  provider: EmailProvider;
  enabled: boolean;
  fromEmail: string | null;
  fromName: string | null;
  missingEnv: string[];
  diagnostics: string[];
};

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

export function isEmailNotificationsEnabled(): boolean {
  const raw = env("EMAIL_NOTIFICATIONS_ENABLED");
  if (!raw) return true;
  return !/^(0|false|no|off)$/i.test(raw);
}

export function hasSmtpConfigured(): boolean {
  return Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASSWORD"));
}

export function hasResendConfigured(): boolean {
  return Boolean(env("RESEND_API_KEY"));
}

export function hasAnyEmailProvider(): boolean {
  return hasSmtpConfigured() || hasResendConfigured();
}

/** auto / пусто → Resend первым (доставка любому получателю), затем SMTP. */
export function resolveEmailProvider(): EmailProvider {
  const explicit = env("EMAIL_PROVIDER")?.toLowerCase();
  if (explicit === "none" || explicit === "off") return "none";
  if (explicit === "smtp") {
    if (hasSmtpConfigured()) return "smtp";
    if (hasResendConfigured()) return "resend";
    return "none";
  }
  if (explicit === "resend") {
    if (hasResendConfigured()) return "resend";
    if (hasSmtpConfigured()) return "smtp";
    return "none";
  }

  if (hasResendConfigured()) return "resend";
  if (hasSmtpConfigured()) return "smtp";
  return "none";
}

export function getEmailConfigStatus(): EmailConfigStatus {
  const enabled = isEmailNotificationsEnabled();
  const provider = resolveEmailProvider();
  const missingEnv: string[] = [];
  const diagnostics: string[] = [];

  const fromEmail = env("SMTP_FROM_EMAIL") ?? env("RESEND_FROM_EMAIL") ?? null;
  const fromName = env("SMTP_FROM_NAME") ?? null;

  if (!enabled) {
    diagnostics.push("EMAIL_NOTIFICATIONS_ENABLED выключен");
  }

  const smtpReady = hasSmtpConfigured();
  const resendReady =
    hasResendConfigured() && Boolean(env("RESEND_FROM_EMAIL") ?? env("SMTP_FROM_EMAIL"));

  if (provider === "smtp" && smtpReady) {
    if (!env("SMTP_HOST")) missingEnv.push("SMTP_HOST");
    if (!env("SMTP_USER")) missingEnv.push("SMTP_USER");
    if (!env("SMTP_PASSWORD")) missingEnv.push("SMTP_PASSWORD");
    // Mail.ru: From = SMTP_USER; RESEND_FROM / SMTP_FROM опционален
  } else if (provider === "resend" && resendReady) {
    if (!env("RESEND_API_KEY")) missingEnv.push("RESEND_API_KEY");
    if (!fromEmail) missingEnv.push("RESEND_FROM_EMAIL");
  } else if (!smtpReady && !resendReady) {
    if (!hasResendConfigured() && !env("SMTP_HOST")) missingEnv.push("SMTP_HOST or RESEND_API_KEY");
    diagnostics.push("Email-провайдер не настроен (SMTP или RESEND_API_KEY)");
  }

  return { provider, enabled, fromEmail, fromName, missingEnv, diagnostics };
}

function extractEmailAddress(raw: string): string {
  const m = raw.match(/<([^>]+)>/);
  return (m?.[1] ?? raw).trim();
}

/** From-имя по сайту (SPOTIFY STORE / GPT STORE), адрес из SMTP/Resend env. */
export function resolveFromAddress(siteSlug?: SiteSlug): string {
  const rawFrom = env("SMTP_FROM_EMAIL") ?? env("RESEND_FROM_EMAIL") ?? "";
  const emailOnly = rawFrom ? extractEmailAddress(rawFrom) : null;

  const brandName = siteSlug ? getSiteBySlug(siteSlug).brandName : (env("SMTP_FROM_NAME") ?? "GPT STORE");

  if (emailOnly) return `${brandName} <${emailOnly}>`;
  return `${brandName} <onboarding@resend.dev>`;
}

export function resolveOperatorEmails(): string[] {
  const operator = env("OPERATOR_EMAIL");
  const operators = (env("OPERATOR_EMAILS") ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const all = operator ? [operator.toLowerCase(), ...operators] : operators;
  return Array.from(new Set(all));
}
