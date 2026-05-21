/**
 * Читает .env.local, подключается к Subs Supabase (SUBS_*),
 * находит пользователя в Subs Auth (по ADMIN_EMAIL или первому из ADMIN_EMAILS, иначе первый в списке)
 * и записывает SUBS_NOTIFICATIONS_INBOX_USER_ID в .env.local.
 *
 * Запуск: node scripts/sync-subs-inbox-user-id.cjs
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env.local");

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
    if (host.includes("csolintnzrwl")) {
      host = host.replace(/csolintnzrwl/g, "csolintnznwl");
    }
    return `https://${host}`;
  } catch {
    return s.replace(/\/$/, "");
  }
}

function primaryAdminEmail(env) {
  const direct = (env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (direct) return direct;
  const list = (env.ADMIN_EMAILS || "").trim();
  if (!list) return "";
  const first = list.split(",")[0]?.trim().toLowerCase();
  return first || "";
}

async function main() {
  if (!fs.existsSync(envPath)) {
    console.error("Файл .env.local не найден:", envPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(envPath, "utf8");
  const env = parseEnv(raw);
  const url = normalizeUrl(env.SUBS_SUPABASE_URL);
  const key = env.SUBS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("В .env.local нужны SUBS_SUPABASE_URL и SUBS_SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const subs = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const wantEmail = primaryAdminEmail(env);
  let pickedId = null;

  const { data: page1, error: e1 } = await subs.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (e1) {
    console.error("Subs Auth listUsers:", e1.message);
    if (String(e1.message).includes("fetch failed") || String(e1).includes("ENOTFOUND")) {
      console.error(
        "Проверьте SUBS_SUPABASE_URL: поддомен должен совпадать с Supabase Dashboard (частая опечатка: …nznwl… vs …nzrwl…).",
      );
    }
    process.exit(1);
  }
  const users = page1?.users ?? [];
  if (!users.length) {
    console.error(
      "В проекте Subs (spotify) нет ни одного пользователя в Authentication. Создайте пользователя в Dashboard → Authentication → Users, затем снова запустите этот скрипт.",
    );
    process.exit(1);
  }

  if (wantEmail) {
    const m = users.find((u) => (u.email || "").trim().toLowerCase() === wantEmail);
    if (m) pickedId = m.id;
  }
  if (!pickedId) {
    pickedId = users[0].id;
    if (wantEmail) {
      console.warn(
        `Пользователь с email «${wantEmail}» не найден в Subs Auth среди первых 200. Взят первый пользователь из списка.`,
      );
    }
  }

  const lines = raw.split(/\r?\n/);
  const filtered = lines.filter((l) => !/^\s*SUBS_NOTIFICATIONS_INBOX_USER_ID\s*=/.test(l));
  const body = filtered.join("\n").replace(/\s+$/, "");
  const correctedSubsUrl = normalizeUrl(env.SUBS_SUPABASE_URL);
  const urlLines = body.split(/\r?\n/).map((l) => {
    if (/^\s*SUBS_SUPABASE_URL\s*=/.test(l)) {
      return `SUBS_SUPABASE_URL=${correctedSubsUrl}`;
    }
    return l;
  });
  const out = `${urlLines.join("\n")}\nSUBS_NOTIFICATIONS_INBOX_USER_ID=${pickedId}\n`;
  fs.writeFileSync(envPath, out, "utf8");

  const short = `${pickedId.slice(0, 8)}…${pickedId.slice(-4)}`;
  console.log("Готово: SUBS_SUPABASE_URL исправлен при необходимости; записан SUBS_NOTIFICATIONS_INBOX_USER_ID =", short);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
