/**
 * Проверяет колонку profiles.telegram_username в Subs Supabase и при необходимости
 * применяет миграцию (Management API) или выводит SQL для SQL Editor.
 *
 * .env.local: SUBS_SUPABASE_URL, SUBS_SUPABASE_SERVICE_ROLE_KEY
 * Опционально: SUPABASE_ACCESS_TOKEN (Personal Access Token) — тогда DDL выполнится автоматически.
 *
 * Запуск: npm run subs:db:telegram-username
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
  "002_profiles_telegram_username.sql",
);

function parseEnv(content) {
  /** @type {Record<string, string>} */
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
    const host = new URL(url).hostname;
    const ref = host.split(".")[0];
    return ref || null;
  } catch {
    return null;
  }
}

async function columnExists(subs) {
  const { error } = await subs.from("profiles").select("telegram_username").limit(1);
  if (!error) return true;
  if (/telegram_username/i.test(error.message) && /does not exist/i.test(error.message)) {
    return false;
  }
  throw new Error(`Проверка колонки: ${error.message}`);
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
  if (!res.ok) {
    throw new Error(`Management API ${res.status}: ${text.slice(0, 400)}`);
  }
}

/** На Windows Node иногда падает с UV_HANDLE_CLOSING при немедленном process.exit после fetch. */
function exitSoon(code) {
  setTimeout(() => process.exit(code), 100);
}

async function main() {
  const pkgHere = fs.existsSync(path.join(process.cwd(), "package.json"));
  if (!pkgHere) {
    console.warn(
      "Подсказка: запускайте из корня проекта (Chat_Spotify-main), не из node_modules:\n  cd ..\\..\n",
    );
  }

  if (!fs.existsSync(envPath)) {
    console.error("Нет .env.local:", envPath);
    exitSoon(1);
    return;
  }
  if (!fs.existsSync(migrationPath)) {
    console.error("Нет файла миграции:", migrationPath);
    exitSoon(1);
    return;
  }

  const env = parseEnv(fs.readFileSync(envPath, "utf8"));
  const url = normalizeUrl(env.SUBS_SUPABASE_URL);
  const key = env.SUBS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Нужны SUBS_SUPABASE_URL и SUBS_SUPABASE_SERVICE_ROLE_KEY в .env.local");
    exitSoon(1);
    return;
  }

  const subs = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (await columnExists(subs)) {
    console.log("OK: profiles.telegram_username уже есть в Subs Store.");
    exitSoon(0);
    return;
  }

  const sql = fs.readFileSync(migrationPath, "utf8");
  const accessToken = (env.SUPABASE_ACCESS_TOKEN || "").trim();
  const projectRef = projectRefFromUrl(url);

  if (accessToken && projectRef) {
    console.log("Колонки нет — применяю миграцию через Supabase Management API…");
    try {
      await applyViaManagementApi(projectRef, accessToken, sql);
      if (await columnExists(subs)) {
        console.log("Готово: profiles.telegram_username добавлена.");
        exitSoon(0);
        return;
      }
      console.warn("Запрос API прошёл, но колонка всё ещё не видна через REST. Подождите 5–10 с и запустите снова.");
      exitSoon(0);
      return;
    } catch (err) {
      console.warn("Management API:", err instanceof Error ? err.message : err);
      console.warn("Выполните SQL вручную (см. ниже).\n");
    }
  }

  console.log("Это не ошибка скрипта: колонку нужно создать в Supabase (скрипт только проверяет).\n");
  console.log("Колонки profiles.telegram_username нет в Subs Store.\n");
  console.log("1) Откройте https://supabase.com/dashboard → проект Subs Store → SQL → New query");
  console.log("2) Вставьте и нажмите Run:\n");
  console.log(
    "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_username text;",
  );
  console.log("\n3) Снова в корне проекта: npm run subs:db:telegram-username");
  console.log("   (должно быть: OK: profiles.telegram_username уже есть…)");
  console.log("\nПолный файл миграции:", migrationPath);
  exitSoon(1);
}

main().catch((err) => {
  console.error(err);
  exitSoon(1);
});
