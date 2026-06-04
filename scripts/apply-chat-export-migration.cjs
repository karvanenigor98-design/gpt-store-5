/**
 * GPT Supabase: chat export audit log (018).
 * .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Опционально: SUPABASE_ACCESS_TOKEN — DDL через Management API.
 *
 * npm run gpt:db:chat-export-logs
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env.local");
const migrationPath = path.join(root, "supabase", "migrations", "018_chat_export_logs.sql");

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

async function migrationOk(supabase) {
  const { error } = await supabase.from("chat_export_logs").select("id").limit(1);
  if (!error) return true;
  if (/chat_export_logs/i.test(error.message)) return false;
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
  const url = normalizeUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY");
    exitSoon(1);
    return;
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (await migrationOk(supabase)) {
    console.log("OK: migration 018 уже применена (chat_export_logs).");
    exitSoon(0);
    return;
  }

  const sql = fs.readFileSync(migrationPath, "utf8");
  const accessToken = (env.SUPABASE_ACCESS_TOKEN || "").trim();
  const projectRef = projectRefFromUrl(url);

  if (accessToken && projectRef) {
    console.log("Применяю supabase/migrations/018 через Management API…");
    try {
      await applyViaManagementApi(projectRef, accessToken, sql);
      if (await migrationOk(supabase)) {
        console.log("Готово: chat_export_logs.");
        exitSoon(0);
        return;
      }
    } catch (err) {
      console.warn("Management API:", err instanceof Error ? err.message : err);
    }
  }

  console.log("\nВыполните в Supabase Dashboard → GPT project → SQL → Run:\n");
  console.log(sql);
  console.log("\nЗатем: npm run gpt:db:chat-export-logs");
  exitSoon(1);
}

main().catch((err) => {
  console.error(err);
  exitSoon(1);
});
