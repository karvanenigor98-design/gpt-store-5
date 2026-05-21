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

export function resolveEmailProvider(): EmailProvider {
  const explicit = env("EMAIL_PROVIDER")?.toLowerCase();
  if (explicit === "smtp") return "smtp";
  if (explicit === "resend") return "resend";
  if (explicit === "none" || explicit === "off") return "none";

  const smtpHost = env("SMTP_HOST");
  const smtpUser = env("SMTP_USER");
  const smtpPassword = env("SMTP_PASSWORD");
  if (smtpHost && smtpUser && smtpPassword) return "smtp";

  if (env("RESEND_API_KEY")) return "resend";
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

  if (provider === "smtp") {
    if (!env("SMTP_HOST")) missingEnv.push("SMTP_HOST");
    if (!env("SMTP_PORT")) missingEnv.push("SMTP_PORT");
    if (!env("SMTP_USER")) missingEnv.push("SMTP_USER");
    if (!env("SMTP_PASSWORD")) missingEnv.push("SMTP_PASSWORD");
    if (!fromEmail) missingEnv.push("SMTP_FROM_EMAIL");
  } else if (provider === "resend") {
    if (!env("RESEND_API_KEY")) missingEnv.push("RESEND_API_KEY");
    if (!fromEmail) missingEnv.push("RESEND_FROM_EMAIL");
  } else {
    diagnostics.push("Email-провайдер не настроен (SMTP или RESEND_API_KEY)");
  }

  return { provider, enabled, fromEmail, fromName, missingEnv, diagnostics };
}

export function resolveFromAddress(): string {
  const fromEmail = env("SMTP_FROM_EMAIL") ?? env("RESEND_FROM_EMAIL");
  const fromName = env("SMTP_FROM_NAME");
  if (fromEmail && fromName) return `${fromName} <${fromEmail}>`;
  if (fromEmail) return fromEmail;
  return "GPT STORE <onboarding@resend.dev>";
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
