/**
 * Тест Telegram через production: кладёт сообщение в outbox (Supabase) и дергает cron.
 * Usage:
 *   node scripts/test-telegram-prod.cjs
 *   node scripts/test-telegram-prod.cjs --subs
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.join(__dirname, "..");
const envPath = path.join(ROOT, ".env.local");
const prodEnvPath = path.join(ROOT, ".env.vercel.production.local");
const PROD_URL =
  process.env.TELEGRAM_OUTBOX_DRAIN_URL ||
  process.env.PROD_APP_URL ||
  "https://gpt-store-5.vercel.app";
const IS_SUBS = process.argv.includes("--subs");

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
  const chatId = IS_SUBS
    ? process.env.TELEGRAM_SUBS_ADMIN_CHAT_ID?.trim() ||
      process.env.TELEGRAM_ADMIN_CHAT_ID?.trim()
    : process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  const siteSlug = IS_SUBS ? "subs-store" : "gpt-store";
  const brand = IS_SUBS ? "SPOTIFY STORE" : "GPT STORE";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!cronSecret) throw new Error("CRON_SECRET пуст в .env.local");
  if (!chatId) throw new Error("TELEGRAM_*_ADMIN_CHAT_ID пуст");
  if (!url || !serviceKey) throw new Error("Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const dedupe = `telegram:test:prod:${siteSlug}:${Date.now()}`;
  const text = `✅ Production test ${brand}\n${new Date().toISOString()}`;

  const { error: insertError } = await supabase.from("notification_outbox").insert({
    channel: "telegram",
    site_slug: siteSlug,
    event_type: "test.telegram",
    recipient: chatId,
    payload: { text },
    dedupe_key: dedupe,
    status: "pending",
    next_attempt_at: new Date().toISOString(),
  });

  if (insertError) throw new Error(`outbox insert: ${insertError.message}`);
  console.log("outbox queued", { siteSlug, chatId });

  const cronRes = await fetch(`${PROD_URL}/api/cron/notification-outbox`, {
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  const body = await cronRes.text();
  if (!cronRes.ok) throw new Error(`cron ${cronRes.status}: ${body}`);

  console.log("cron OK:", body);
  console.log(`Проверь Telegram-чат (chat_id=${chatId}, site=${siteSlug})`);
}

main().catch((e) => {
  console.error("FAIL:", e.message || e);
  process.exit(1);
});
