/**
 * Добавляет profiles.client_stage в GPT и Subs Supabase (если колонки нет).
 *
 * .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (GPT)
 *   SUBS_SUPABASE_URL + SUBS_SUPABASE_SERVICE_ROLE_KEY (Subs)
 *   SUPABASE_ACCESS_TOKEN — опционально, для DDL через Management API
 *
 * npm run db:client-stage
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env.local");

const MIGRATIONS = [
  {
    label: "GPT STORE",
    urlKeys: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"],
    keyKeys: ["SUPABASE_SERVICE_ROLE_KEY"],
    sqlPath: path.join(root, "supabase", "migrations", "014_profiles_client_stage.sql"),
  },
  {
    label: "SPOTIFY STORE (Subs)",
    urlKeys: ["SUBS_SUPABASE_URL"],
    keyKeys: ["SUBS_SUPABASE_SERVICE_ROLE_KEY"],
    sqlPath: path.join(
      root,
      "supabase",
      "subs-store-migrations",
      "005_profiles_client_stage.sql",
    ),
  },
];

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

function pick(env, keys) {
  for (const k of keys) {
    const v = (env[k] || "").trim();
    if (v) return v;
  }
  return "";
}

function normalizeUrl(raw) {
  const s = String(raw || "").trim();
  try {
    const u = new URL(s);
    if (u.protocol !== "https:") return s;
    let host = u.hostname;
    if (host.includes("csolintnzrwl") || host.includes("csolintnznwl")) {
      host = host.replace(/csolintnzrwl|csolintnznwl/g, "csolinhnznwl");
    }
    return `https://${host}`;
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

async function columnExists(client) {
  const { error } = await client.from("profiles").select("client_stage").limit(1);
  if (!error) return true;
  if (/client_stage/i.test(error.message) && /does not exist|schema cache/i.test(error.message)) {
    return false;
  }
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

function exitSoon(code) {
  setTimeout(() => process.exit(code), 100);
}

async function applyTarget(target, env) {
  const url = normalizeUrl(pick(env, target.urlKeys));
  const key = pick(env, target.keyKeys);
  if (!url || !key) {
    console.log(`[${target.label}] пропуск — нет URL/service key в .env.local`);
    return true;
  }
  if (!fs.existsSync(target.sqlPath)) {
    console.error(`[${target.label}] нет файла:`, target.sqlPath);
    return false;
  }

  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (await columnExists(client)) {
    console.log(`[${target.label}] OK — profiles.client_stage уже есть`);
    return true;
  }

  const sql = fs.readFileSync(target.sqlPath, "utf8");
  const accessToken = (env.SUPABASE_ACCESS_TOKEN || "").trim();
  const projectRef = projectRefFromUrl(url);

  if (accessToken && projectRef) {
    console.log(`[${target.label}] применяю миграцию через Management API…`);
    try {
      await applyViaManagementApi(projectRef, accessToken, sql);
      await new Promise((r) => setTimeout(r, 2000));
      if (await columnExists(client)) {
        console.log(`[${target.label}] готово — client_stage добавлен`);
        return true;
      }
      console.warn(`[${target.label}] API OK, но колонка ещё не в REST cache — подождите и перезапустите`);
      return true;
    } catch (err) {
      console.warn(
        `[${target.label}] Management API:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(`\n[${target.label}] Выполните SQL в Supabase Dashboard → SQL Editor:\n`);
  console.log(sql);
  console.log("");
  return false;
}

async function main() {
  if (!fs.existsSync(envPath)) {
    console.error("Нет .env.local:", envPath);
    exitSoon(1);
    return;
  }

  const env = parseEnv(fs.readFileSync(envPath, "utf8"));
  let ok = true;
  for (const target of MIGRATIONS) {
    const r = await applyTarget(target, env);
    if (!r) ok = false;
  }

  if (ok) {
    console.log("\nВсе целевые базы проверены. При необходимости: Supabase → Settings → API → Reload schema cache.");
    exitSoon(0);
  } else {
    console.log("\nЧасть миграций требует ручного SQL (см. выше). После Run: npm run db:client-stage");
    exitSoon(1);
  }
}

main().catch((err) => {
  console.error(err);
  exitSoon(1);
});
