/**
 * Синхронизирует Pally и APP URL из .env.local → Vercel (production + preview).
 * Usage: node scripts/sync-pally-env-vercel.cjs [--dry-run] [--preview]
 *
 * После синхронизации: npx vercel --prod
 * В кабинете Pally: разрешите IP Vercel (регион fra1) или снимите жёсткий IP-filter.
 */
const fs = require("fs");
const path = require("path");
const { requireVercelToken } = require("./lib/vercel-token.cjs");
const { upsertProjectEnv } = require("./lib/vercel-env-api.cjs");

const ROOT = path.join(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env.local");
const DRY = process.argv.includes("--dry-run");

const KEYS = [
  "APP_URL",
  "GPT_SITE_URL",
  "SPOTIFY_SITE_URL",
  "NEXT_PUBLIC_GPT_SITE_URL",
  "NEXT_PUBLIC_SPOTIFY_SITE_URL",
  "NEXT_PUBLIC_SPOTIFY_STORE_URL",
  "NEXT_PUBLIC_SUBS_STORE_URL",
  "PALLY_SHOP_ID",
  "PALLY_SHOP_ID_GPT",
  "PALLY_SHOP_ID_SUBS",
  "PALLY_SECRET_KEY",
  "PALLY_WEBHOOK_SECRET",
  "PALLY_WEBHOOK_REQUIRE_SIGN",
  "PALLY_API_URL",
  "PALLY_TEST_MODE",
  "PALLY_RELAY_URL",
  "PALLY_RELAY_SECRET",
  "PALLY_RELAY_STRICT",
  "PALLY_HTTP_PROXY",
  "NEXT_PUBLIC_APP_URL",
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

function normalizePallyApiUrl(raw) {
  const trimmed = String(raw || "https://pally.info/api/v1")
    .trim()
    .replace(/\/$/, "");
  if (/api\.pally\.info/i.test(trimmed)) return "https://pally.info/api/v1";
  return trimmed || "https://pally.info/api/v1";
}

if (!DRY) {
  try {
    requireVercelToken();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

const PROD_APP_URL = "https://gpt-store-5.vercel.app";
const PROD_GPT_SITE_URL = "https://gptplus-store.ru";
const PROD_SPOTIFY_SITE_URL = "https://spotify-store.ru";

function resolveAppUrlForVercel(localValue, environment) {
  const raw = (localValue || "").trim();
  if (environment !== "production" && environment !== "preview") return raw;
  if (!raw) return PROD_APP_URL;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
      console.warn(`  warn NEXT_PUBLIC_APP_URL: ${raw} → ${PROD_APP_URL} (${environment})`);
      return PROD_APP_URL;
    }
    return u.origin;
  } catch {
    return PROD_APP_URL;
  }
}

function resolveStoreSiteUrlForVercel(localValue, fallback) {
  const raw = (localValue || "").trim();
  if (!raw) return fallback;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
      return fallback;
    }
    return u.origin;
  } catch {
    return fallback;
  }
}

const env = parseEnvFile(ENV_FILE);
env.PALLY_API_URL = normalizePallyApiUrl(env.PALLY_API_URL);

const missing = KEYS.filter((k) => k !== "PALLY_API_URL" && !env[k]?.trim());
if (missing.length) {
  console.warn("Пустые ключи в .env.local:", missing.join(", "));
}

console.log(DRY ? "DRY RUN — Vercel не меняется" : "Синхронизация Pally env → Vercel");
let failed = 0;

const ENVIRONMENTS = process.argv.includes("--preview")
  ? ["production", "preview"]
  : ["production"];

(async () => {
  for (const environment of ENVIRONMENTS) {
    console.log(`\n[${environment}]`);
    for (const key of KEYS) {
      let value = env[key]?.trim() ?? "";
      if (key === "NEXT_PUBLIC_APP_URL" || key === "APP_URL") {
        value = resolveAppUrlForVercel(
          key === "APP_URL" ? value || PROD_APP_URL : value,
          environment,
        );
      }
      if (key === "GPT_SITE_URL" || key === "NEXT_PUBLIC_GPT_SITE_URL") {
        value = resolveStoreSiteUrlForVercel(value, PROD_GPT_SITE_URL);
      }
      if (
        key === "SPOTIFY_SITE_URL" ||
        key === "NEXT_PUBLIC_SPOTIFY_SITE_URL" ||
        key === "NEXT_PUBLIC_SPOTIFY_STORE_URL" ||
        key === "NEXT_PUBLIC_SUBS_STORE_URL"
      ) {
        value = resolveStoreSiteUrlForVercel(value, PROD_SPOTIFY_SITE_URL);
      }
      if (key === "PALLY_RELAY_STRICT" && environment === "production") {
        value = "false";
      }
      const r = await upsertEnv(key, value, environment);
      if (!r.ok) failed += 1;
    }
  }

  if (failed) {
    console.error(`\nОшибок: ${failed}`);
    process.exit(1);
  }

  console.log("\nГотово.");
  console.log("Redeploy: node scripts/vercel-redeploy-prod.cjs");
  console.log(
    "Pally: в настройках магазина добавьте IP Vercel (регион fra1) или отключите IP-filter для проверки.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
