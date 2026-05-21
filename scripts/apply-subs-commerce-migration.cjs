/**
 * Subs Supabase: таблицы discounts/promocodes и колонка tariff_slugs.
 * .env.local: SUBS_SUPABASE_URL, SUBS_SUPABASE_SERVICE_ROLE_KEY
 * Опционально: SUPABASE_ACCESS_TOKEN — DDL через Management API.
 *
 * npm run subs:db:commerce
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env.local");
const migrationPath = path.join(
  root,
  "supabase",
  "subs-store-migrations",
  "003_discounts_promocodes_commerce.sql",
);

function parseEnv(content) {
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

function normalizeUrl(raw) {
  const s = String(raw || "").trim();
  try {
    const u = new URL(s);
    return `https://${u.hostname}`;
  } catch {
    return s.replace(/\/$/, "");
  }
}

function projectRefFromUrl(url) {
  try {
    return new URL(url).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

function exitSoon(code) {
  setTimeout(() => process.exit(code), 100);
}

async function tariffSlugsOk(subs) {
  const { error } = await subs.from("discounts").select("tariff_slugs").limit(1);
  if (!error) return true;
  if (/tariff_slugs/i.test(error.message)) return false;
  if (/relation.*discounts.*does not exist/i.test(error.message)) return false;
  throw new Error(error.message);
}

async function applyViaManagementApi(projectRef, token, sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${text.slice(0, 400)}`);
}

async function main() {
  if (!fs.existsSync(envPath)) {
    console.error("Нет .env.local");
    exitSoon(1);
    return;
  }

  const env = parseEnv(fs.readFileSync(envPath, "utf8"));
  const url = normalizeUrl(env.SUBS_SUPABASE_URL);
  const key = env.SUBS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Нужны SUBS_SUPABASE_URL и SUBS_SUPABASE_SERVICE_ROLE_KEY");
    exitSoon(1);
    return;
  }

  const subs = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (await tariffSlugsOk(subs)) {
    console.log("OK: discounts.tariff_slugs уже есть в Subs Store.");
    exitSoon(0);
    return;
  }

  const sql = fs.readFileSync(migrationPath, "utf8");
  const accessToken = (env.SUPABASE_ACCESS_TOKEN || "").trim();
  const projectRef = projectRefFromUrl(url);

  if (accessToken && projectRef) {
    console.log("Применяю subs-store-migrations/003 через Management API…");
    try {
      await applyViaManagementApi(projectRef, accessToken, sql);
      if (await tariffSlugsOk(subs)) {
        console.log("Готово: commerce-таблицы и tariff_slugs на месте.");
        exitSoon(0);
        return;
      }
    } catch (err) {
      console.warn("Management API:", err instanceof Error ? err.message : err);
    }
  }

  console.log("\nВыполните в Supabase Dashboard → Subs Store → SQL → Run:\n");
  console.log(fs.readFileSync(migrationPath, "utf8"));
  console.log("\nЗатем: npm run subs:db:commerce");
  exitSoon(1);
}

main().catch((err) => {
  console.error(err);
  exitSoon(1);
});
