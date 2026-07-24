/**
 * Синхронизирует Telegram-переменные из .env.local → Vercel (production).
 * Usage: node scripts/sync-telegram-env-vercel.cjs [--dry-run] [--preview]
 *
 * После синхронизации: node scripts/vercel-redeploy-prod.cjs
 */
const fs = require("fs");
const path = require("path");
const { requireVercelToken } = require("./lib/vercel-token.cjs");
const { upsertProjectEnv } = require("./lib/vercel-env-api.cjs");

const ROOT = path.join(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env.local");
const DRY = process.argv.includes("--dry-run");

const KEYS = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_ADMIN_CHAT_ID",
  "TELEGRAM_BOT_USERNAME",
  "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME",
  "TELEGRAM_SUBS_BOT_TOKEN",
  "TELEGRAM_SUBS_ADMIN_CHAT_ID",
  "TELEGRAM_SUBS_BOT_USERNAME",
  "TELEGRAM_WEBHOOK_SECRET",
  "TELEGRAM_REVIEWS_GROUP_ID",
  "NEXT_PUBLIC_TELEGRAM_REVIEWS_URL",
];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error("Нет файла:", filePath);
    process.exit(1);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function normalizeTelegramEnv(env) {
  const out = { ...env };

  if (!out.TELEGRAM_ADMIN_CHAT_ID?.trim()) {
    out.TELEGRAM_ADMIN_CHAT_ID =
      out.TELEGRAM_REVIEWS_CHAT_ID?.trim() || out.TELEGRAM_REVIEWS_CHAT?.trim() || "";
  }

  if (!out.TELEGRAM_REVIEWS_GROUP_ID?.trim()) {
    out.TELEGRAM_REVIEWS_GROUP_ID =
      out.TELEGRAM_REVIEWS_CHAT_ID?.trim() || out.TELEGRAM_REVIEWS_CHAT?.trim() || "";
  }

  if (!out.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim() && out.TELEGRAM_BOT_USERNAME?.trim()) {
    out.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = out.TELEGRAM_BOT_USERNAME.trim();
  }

  return out;
}

async function upsertEnv(name, value, environment) {
  if (!value) {
    console.log(`  skip ${name} (${environment}): пусто в .env.local`);
    return { ok: true, skipped: true };
  }
  if (DRY) {
    console.log(`  [dry-run] ${name} → ${environment} (len=${value.length})`);
    return { ok: true, skipped: true };
  }

  const r = await upsertProjectEnv(name, value, environment);
  if (r.ok) {
    console.log(`  ok ${name} → ${environment}`);
    return { ok: true };
  }

  console.error(
    `  FAIL ${name} → ${environment}:`,
    r.status,
    r.json?.error?.message || JSON.stringify(r.json).slice(0, 200),
  );
  return { ok: false };
}

if (!DRY) {
  try {
    requireVercelToken();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

const env = normalizeTelegramEnv(parseEnvFile(ENV_FILE));

if (!env.TELEGRAM_BOT_TOKEN?.trim() || !env.TELEGRAM_ADMIN_CHAT_ID?.trim()) {
  console.error("В .env.local нужны TELEGRAM_BOT_TOKEN и TELEGRAM_ADMIN_CHAT_ID");
  process.exit(1);
}

console.log(DRY ? "DRY RUN — Vercel не меняется" : "Синхронизация Telegram env → Vercel");

const ENVIRONMENTS = process.argv.includes("--preview")
  ? ["production", "preview"]
  : ["production"];

(async () => {
  let failed = 0;
  for (const environment of ENVIRONMENTS) {
    console.log(`\n[${environment}]`);
    for (const key of KEYS) {
      const value = env[key]?.trim() ?? "";
      const r = await upsertEnv(key, value, environment);
      if (!r.ok) failed += 1;
    }
  }

  if (failed) {
    console.error(`\nОшибок: ${failed}`);
    process.exit(1);
  }

  console.log("\nГотово.");
  console.log("Проверка локально: npm run telegram:test");
  console.log("Redeploy: node scripts/vercel-redeploy-prod.cjs");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
