import nodemailer from "nodemailer";

import type { SiteSlug } from "@/lib/sites";

import {
  hasAnyEmailProvider,
  hasResendConfigured,
  hasSmtpConfigured,
  isEmailNotificationsEnabled,
  resolveFromAddress,
} from "@/lib/email/config";
import { resolveSmtpFromAddress } from "@/lib/email/smtp-from";

export type SendEmailResult = {
  ok: boolean;
  skipped: boolean;
  provider: "smtp" | "resend" | "none";
  error?: string;
};

let lastEmailError: string | null = null;

export function getLastEmailError(): string | null {
  return lastEmailError;
}

function providersToTry(): ("resend" | "smtp")[] {
  const explicit = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  const order: ("resend" | "smtp")[] = [];

  if (explicit === "smtp") {
    if (hasSmtpConfigured()) order.push("smtp");
    if (hasResendConfigured()) order.push("resend");
  } else if (explicit === "resend" || explicit === "auto" || !explicit) {
    if (hasResendConfigured()) order.push("resend");
    if (hasSmtpConfigured()) order.push("smtp");
  }

  return order;
}

async function sendViaSmtp(
  to: string,
  subject: string,
  text: string,
  html?: string,
  from?: string,
): Promise<SendEmailResult> {
  const host = process.env.SMTP_HOST?.trim();
  const portRaw = process.env.SMTP_PORT?.trim() ?? "587";
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();

  if (!host) return { ok: false, skipped: false, provider: "smtp", error: "Не найден SMTP_HOST в .env.local" };
  if (!user) return { ok: false, skipped: false, provider: "smtp", error: "Не найден SMTP_USER в .env.local" };
  if (!pass) return { ok: false, skipped: false, provider: "smtp", error: "Не найден SMTP_PASSWORD в .env.local" };

  const port = Number(portRaw);
  if (!Number.isFinite(port)) {
    return { ok: false, skipped: false, provider: "smtp", error: "SMTP_PORT имеет неверный формат" };
  }

  const secure = port === 465;

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: from ?? resolveSmtpFromAddress(),
      to,
      subject,
      text,
      html: html ?? `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${text}</pre>`,
    });

    lastEmailError = null;
    return { ok: true, skipped: false, provider: "smtp" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMTP send failed";
    lastEmailError = message;
    return { ok: false, skipped: false, provider: "smtp", error: message };
  }
}

async function sendViaResend(
  to: string,
  subject: string,
  text: string,
  html?: string,
  from?: string,
): Promise<SendEmailResult> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!resendKey) {
    return { ok: false, skipped: false, provider: "resend", error: "Не найден RESEND_API_KEY в .env.local" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: from ?? resolveFromAddress(),
        to: [to],
        subject,
        text,
        html: html ?? `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${text}</pre>`,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      lastEmailError = body.slice(0, 500);
      return { ok: false, skipped: false, provider: "resend", error: `Resend HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    lastEmailError = null;
    return { ok: true, skipped: false, provider: "resend" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Resend network error";
    lastEmailError = message;
    return { ok: false, skipped: false, provider: "resend", error: message };
  }
}

/** Отправка transactional email server-side. Не бросает исключения. */
export async function sendTransactionalEmail(
  to: string,
  subject: string,
  text: string,
  html?: string,
  options?: { siteSlug?: SiteSlug },
): Promise<SendEmailResult> {
  const siteSlug = options?.siteSlug;
  const resendFrom = siteSlug ? resolveFromAddress(siteSlug) : resolveFromAddress();
  const smtpFrom = siteSlug ? resolveSmtpFromAddress(siteSlug) : resolveSmtpFromAddress();

  if (!to?.trim()) {
    return { ok: false, skipped: true, provider: "none", error: "Пустой получатель" };
  }

  if (!isEmailNotificationsEnabled()) {
    console.warn("[Email] Пропущено: EMAIL_NOTIFICATIONS_ENABLED выключен");
    return { ok: false, skipped: true, provider: "none", error: "EMAIL_NOTIFICATIONS_ENABLED выключен" };
  }

  const providers = providersToTry();
  if (!providers.length || !hasAnyEmailProvider()) {
    const msg = "Email-провайдер не настроен (SMTP или RESEND_API_KEY)";
    console.warn(`[Email] Пропущено: ${msg}`);
    lastEmailError = msg;
    return { ok: false, skipped: true, provider: "none", error: msg };
  }

  const errors: string[] = [];
  let lastResult: SendEmailResult = { ok: false, skipped: false, provider: "none" };

  for (const provider of providers) {
    const from = provider === "smtp" ? smtpFrom : resendFrom;
    const result =
      provider === "smtp"
        ? await sendViaSmtp(to.trim(), subject, text, html, from)
        : await sendViaResend(to.trim(), subject, text, html, from);

    if (result.ok) return result;

    lastResult = result;
    if (!result.skipped && result.error) {
      errors.push(`${provider}: ${result.error}`);
      console.warn(`[Email] ${provider} failed for ${to.trim()}: ${result.error}`);
    }
  }

  const combined = errors.join("; ") || lastResult.error || "send_failed";
  lastEmailError = combined;
  console.error("[Email] Все провайдеры не смогли отправить:", combined);

  return {
    ok: false,
    skipped: lastResult.skipped,
    provider: lastResult.provider,
    error: combined,
  };
}

export async function sendTransactionalEmailMany(
  recipients: string[],
  subject: string,
  text: string,
  html?: string,
): Promise<SendEmailResult[]> {
  const unique = Array.from(new Set(recipients.map((x) => x.trim().toLowerCase()).filter(Boolean)));
  if (!unique.length) {
    console.warn("[Email] sendTransactionalEmailMany: нет получателей");
    return [];
  }
  return Promise.all(unique.map((email) => sendTransactionalEmail(email, subject, text, html)));
}

/** Уведомить админа об ошибке email (без рекурсии при сбое). */
export async function notifyAdminEmailFailure(context: string, detail: string): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  if (!adminEmail) return;

  const subject = `⚠️ Ошибка отправки email — ${context}`;
  const text = `Не удалось отправить email.\n\nКонтекст: ${context}\nДетали: ${detail.slice(0, 500)}\n\nСобытие сохранено в notifications.`;

  for (const provider of providersToTry()) {
    const result =
      provider === "smtp"
        ? await sendViaSmtp(adminEmail, subject, text)
        : await sendViaResend(adminEmail, subject, text);
    if (result.ok) return;
  }
}
