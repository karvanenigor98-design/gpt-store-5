/**
 * Синхронизирует email-переменные из .env.local → Vercel (production + preview).
 * Usage: node scripts/sync-email-env-vercel.cjs [--dry-run] [--preview]
 *
 * EMAIL_PROVIDER на Vercel не задаётся — auto (Resend → SMTP fallback).
 */
const fs = require("fs");
const path = require("path");
const { requireVercelToken } = require("./lib/vercel-token.cjs");
const { deleteProjectEnv, syncProjectEnvs, listProjectEnv } = require("./lib/vercel-env-api.cjs");

const ROOT = path.join(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env.local");
const DRY = process.argv.includes("--dry-run");

const KEYS = [
  "EMAIL_NOTIFICATIONS_ENABLED",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM_EMAIL",
  "SMTP_FROM_NAME",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "ADMIN_EMAIL",
  "ADMIN_EMAILS",
  "OPERATOR_EMAIL",
  "OPERATOR_EMAILS",
  "SUPPORT_NOTIFICATION_EMAIL",
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
  return { ok: true, name, value };
}

async function removeAutoEmailProvider(environment, knownEnvs) {
  if (DRY) {
    console.log(`  [dry-run] remove EMAIL_PROVIDER → ${environment} (auto mode)`);
    return { ok: true, envs: knownEnvs };
  }
  const r = await deleteProjectEnv("EMAIL_PROVIDER", environment, knownEnvs);
  if (r.ok) {
    console.log(`  ok EMAIL_PROVIDER removed → ${environment} (auto: Resend → SMTP)`);
    const envs = (knownEnvs || []).filter((e) => e.key !== "EMAIL_PROVIDER");
    return { ok: true, envs };
  }
  console.error(
    `  FAIL EMAIL_PROVIDER remove → ${environment}:`,
    r.status,
    r.json?.error?.message || JSON.stringify(r.json).slice(0, 200),
  );
  return { ok: false, envs: knownEnvs };
}

if (!DRY) {
  try {
    requireVercelToken();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

const env = parseEnvFile(ENV_FILE);
const missing = KEYS.filter((k) => !env[k]?.trim());
if (missing.length) {
  console.warn("Пустые ключи в .env.local:", missing.join(", "));
}

console.log(DRY ? "DRY RUN — Vercel не меняется" : "Синхронизация email env → Vercel (gpt-store-5)");
let failed = 0;

const ENVIRONMENTS = process.argv.includes("--preview")
  ? ["production", "preview"]
  : ["production"];

(async () => {
  for (const environment of ENVIRONMENTS) {
    console.log(`\n[${environment}]`);

    if (DRY) {
      for (const key of KEYS) {
        await upsertEnv(key, env[key]?.trim() ?? "", environment);
      }
      console.log(`  [dry-run] remove EMAIL_PROVIDER → ${environment}`);
      continue;
    }

    const list = await listProjectEnv();
    if (!list.ok) {
      console.error("  FAIL list env:", list.status, list.json?.error?.message);
      failed += 1;
      continue;
    }

    let knownEnvs = list.json.envs || [];
    const removeR = await removeAutoEmailProvider(environment, knownEnvs);
    if (!removeR.ok) failed += 1;
    else knownEnvs = removeR.envs || knownEnvs;

    const batch = {};
    for (const key of KEYS) {
      const value = env[key]?.trim() ?? "";
      if (!value) {
        console.log(`  skip ${key} (${environment}): пусто в .env.local`);
        continue;
      }
      batch[key] = value;
    }

    const syncR = await syncProjectEnvs(batch, environment);
    for (const key of Object.keys(batch)) {
      if (syncR.failed?.includes(key)) {
        console.error(`  FAIL ${key} → ${environment}`);
        failed += 1;
      } else {
        console.log(`  ok ${key} → ${environment}`);
      }
    }
  }

  if (failed) {
    console.error(`\nОшибок: ${failed}`);
    process.exit(1);
  }

  console.log("\nГотово. Redeploy: node scripts/vercel-redeploy-prod.cjs");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
