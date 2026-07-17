/**
 * Тест Telegram через production: кладёт сообщение в outbox (Supabase) и дергает cron.
 * Usage: node scripts/test-telegram-prod.cjs
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.join(__dirname, "..");
const envPath = path.join(ROOT, ".env.local");
const prodEnvPath = path.join(ROOT, ".env.vercel.production.local");
const PROD_URL = process.env.PROD_APP_URL || "https://gptplus-store.ru";

function loadEnvFile(filePath, override = false) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (override || !process.env[k]) process.env[k] = v;
  }
}

function loadEnv() {
  if (!fs.existsSync(envPath)) throw new Error("Нет .env.local");
  loadEnvFile(envPath);
  // production CRON_SECRET часто отличается от локального
  loadEnvFile(prodEnvPath, true);
}

async function main() {
  loadEnv();

  const cronSecret = process.env.CRON_SECRET?.trim();
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!cronSecret) throw new Error("CRON_SECRET пуст в .env.local");
  if (!chatId) throw new Error("TELEGRAM_ADMIN_CHAT_ID пуст");
  if (!url || !serviceKey) throw new Error("Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const dedupe = `telegram:test:prod:${Date.now()}`;
  const text = `✅ Production test GPT STORE\n${new Date().toISOString()}`;

  const { error: insertError } = await supabase.from("notification_outbox").insert({
    channel: "telegram",
    site_slug: "gpt-store",
    event_type: "test.telegram",
    recipient: chatId,
    payload: { text },
    dedupe_key: dedupe,
    status: "pending",
    next_attempt_at: new Date().toISOString(),
  });

  if (insertError) throw new Error(`outbox insert: ${insertError.message}`);
  console.log("outbox queued");

  const cronRes = await fetch(`${PROD_URL}/api/cron/notification-outbox`, {
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  const body = await cronRes.text();
  if (!cronRes.ok) throw new Error(`cron ${cronRes.status}: ${body}`);

  console.log("cron OK:", body);
  console.log(`Проверь Telegram-чат (chat_id=${chatId})`);
}

main().catch((e) => {
  console.error("FAIL:", e.message || e);
  process.exit(1);
});
