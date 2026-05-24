/**
 * Синхронизирует email-переменные из .env.local → Vercel (production + preview).
 * Usage: node scripts/sync-email-env-vercel.cjs [--dry-run]
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env.local");
const DRY = process.argv.includes("--dry-run");

const KEYS = [
  "EMAIL_NOTIFICATIONS_ENABLED",
  "EMAIL_PROVIDER",
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

function runVercel(args, stdinValue) {
  return spawnSync("npx", ["vercel", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
    input: stdinValue,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
}

function upsertEnv(name, value, environment) {
  if (!value) {
    console.log(`  skip ${name} (${environment}): пусто в .env.local`);
    return { ok: true, skipped: true };
  }
  if (DRY) {
    console.log(`  [dry-run] ${name} → ${environment} (len=${value.length})`);
    return { ok: true, skipped: true };
  }

  const add = runVercel(
    ["env", "add", name, environment, "--yes", "--force"],
    value,
  );

  const out = `${add.stdout ?? ""}${add.stderr ?? ""}`;
  if (add.status === 0 || /already exists|Updated|overwritten/i.test(out)) {
    console.log(`  ok ${name} → ${environment}`);
    return { ok: true };
  }

  console.error(`  FAIL ${name} → ${environment}:`, out.trim() || add.status);
  return { ok: false };
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

for (const environment of ENVIRONMENTS) {
  console.log(`\n[${environment}]`);
  for (const key of KEYS) {
    const r = upsertEnv(key, env[key]?.trim() ?? "", environment);
    if (!r.ok) failed += 1;
  }
}

if (failed) {
  console.error(`\nОшибок: ${failed}`);
  process.exit(1);
}

console.log("\nГотово. Запусти redeploy: npx vercel --prod");
