/**
 * Sync Spotify/Subs store env from .env.local → Vercel production (+ preview).
 * Run: node scripts/sync-subs-store-prod-env.cjs
 * Then: node scripts/vercel-redeploy-prod.cjs
 */
const fs = require("fs");
const path = require("path");
const { syncProjectEnvs } = require("./lib/vercel-env-api.cjs");

const PROD_GPT_URL = "https://gptplus-store.ru";
const PROD_SPOTIFY_URL = "https://spotify-store.ru";

const KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_GPT_STORE_URL",
  "NEXT_PUBLIC_SPOTIFY_STORE_URL",
  "NEXT_PUBLIC_SUBS_STORE_URL",
  "NEXT_PUBLIC_SUBS_SUPABASE_URL",
  "NEXT_PUBLIC_SUBS_SUPABASE_ANON_KEY",
  "SUBS_SUPABASE_URL",
  "SUBS_SUPABASE_SERVICE_ROLE_KEY",
  "SUBS_NOTIFICATIONS_INBOX_USER_ID",
];

function parseEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local not found");
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
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

function prodStoreUrl(key, local) {
  const raw = (local[key] || "").trim();
  if (key === "NEXT_PUBLIC_APP_URL" || key === "NEXT_PUBLIC_GPT_STORE_URL") {
    return PROD_GPT_URL;
  }
  if (key === "NEXT_PUBLIC_SPOTIFY_STORE_URL" || key === "NEXT_PUBLIC_SUBS_STORE_URL") {
    return PROD_SPOTIFY_URL;
  }
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return null;
  } catch {
    /* use mapped prod URL above for store keys */
  }
  return raw || null;
}

async function main() {
  const local = parseEnvLocal();
  const entries = {};

  for (const key of KEYS) {
    let value = local[key]?.trim() || "";
    if (
      key === "NEXT_PUBLIC_APP_URL" ||
      key === "NEXT_PUBLIC_GPT_STORE_URL" ||
      key === "NEXT_PUBLIC_SPOTIFY_STORE_URL" ||
      key === "NEXT_PUBLIC_SUBS_STORE_URL"
    ) {
      value = prodStoreUrl(key, local) || value;
    }
    if (!value) {
      console.error(`Missing ${key} in .env.local`);
      process.exit(1);
    }
    if (key.includes("URL") && key.includes("SUPABASE") && !/\.supabase\.co/i.test(value)) {
      console.error(`${key} must be a supabase.co URL`);
      process.exit(1);
    }
    entries[key] = value;
  }

  console.log("Syncing Subs/Spotify env → Vercel production…");
  for (const [k, v] of Object.entries(entries)) {
    const preview =
      k.includes("KEY") || k.includes("SECRET") || k.includes("SERVICE_ROLE")
        ? `len=${v.length}`
        : v;
    console.log(`  ${k}: ${preview}`);
  }

  const prod = await syncProjectEnvs(entries, "production");
  if (!prod.ok) {
    console.error("Production sync failed:", prod.failed.join(", "));
    process.exit(1);
  }
  console.log("production OK");

  const preview = await syncProjectEnvs(entries, "preview");
  if (!preview.ok) {
    console.error("Preview sync failed:", preview.failed.join(", "));
    process.exit(1);
  }
  console.log("preview OK");
  console.log("\nDone. Redeploy: node scripts/vercel-redeploy-prod.cjs");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
