/**
 * Локальная проверка SMTP/Resend из .env.local
 * Usage: node scripts/test-email-send.cjs [to@email.com]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const envPath = path.join(ROOT, ".env.local");

function loadEnv() {
  if (!fs.existsSync(envPath)) throw new Error("Нет .env.local");
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

async function main() {
  loadEnv();
  const to =
    process.argv[2]?.trim() ||
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.OPERATOR_EMAIL?.trim();
  if (!to) throw new Error("Укажи email: node scripts/test-email-send.cjs you@mail.com");

  // Dynamic import after env loaded — run via tsx or compile; use nodemailer directly
  const nodemailer = require("nodemailer");

  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  const port = Number(process.env.SMTP_PORT?.trim() || "587");
  const fromEmail = process.env.SMTP_FROM_EMAIL?.trim();
  const fromName = process.env.SMTP_FROM_NAME?.trim() || "GPT STORE";
  const resendKey = process.env.RESEND_API_KEY?.trim();

  const subject = `[Test] GPT STORE email ${new Date().toISOString()}`;
  const text = "Тестовое письмо из scripts/test-email-send.cjs — если видишь это, SMTP/Resend работает.";

  if (host && user && pass) {
    console.log("Пробуем SMTP…");
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: fromEmail ? `${fromName} <${fromEmail}>` : user,
      to,
      subject,
      text,
    });
    console.log("SMTP OK →", to);
    return;
  }

  if (resendKey) {
    console.log("Пробуем Resend…");
    const from = process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    console.log("Resend OK →", to);
    return;
  }

  throw new Error("Нет SMTP_HOST/USER/PASSWORD и нет RESEND_API_KEY в .env.local");
}

main().catch((e) => {
  console.error("FAIL:", e.message || e);
  process.exit(1);
});
