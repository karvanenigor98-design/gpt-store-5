/**
 * Синхронизирует Pally и APP URL из .env.local → Vercel (production + preview).
 * Usage: node scripts/sync-pally-env-vercel.cjs [--dry-run] [--preview]
 *
 * После синхронизации: npx vercel --prod
 * В кабинете Pally: разрешите IP Vercel (регион fra1) или снимите жёсткий IP-filter.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env.local");
const DRY = process.argv.includes("--dry-run");

const KEYS = [
  "PALLY_SHOP_ID",
  "PALLY_SECRET_KEY",
  "PALLY_API_URL",
  "PALLY_TEST_MODE",
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

  const add = runVercel(["env", "add", name, environment, "--yes", "--force"], value);

  const out = `${add.stdout ?? ""}${add.stderr ?? ""}`;
  if (add.status === 0 || /already exists|Updated|overwritten/i.test(out)) {
    console.log(`  ok ${name} → ${environment}`);
    return { ok: true };
  }

  console.error(`  FAIL ${name} → ${environment}:`, out.trim() || add.status);
  return { ok: false };
}

const env = parseEnvFile(ENV_FILE);
if (!env.PALLY_API_URL?.trim()) {
  env.PALLY_API_URL = "https://pally.info/api/v1";
}

const missing = KEYS.filter((k) => k !== "PALLY_API_URL" && !env[k]?.trim());
if (missing.length) {
  console.warn("Пустые ключи в .env.local:", missing.join(", "));
}

console.log(DRY ? "DRY RUN — Vercel не меняется" : "Синхронизация Pally env → Vercel");
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

console.log("\nГотово.");
console.log("Redeploy: npx vercel --prod");
console.log(
  "Pally: в настройках магазина добавьте IP Vercel (регион fra1) или отключите IP-filter для проверки.",
);
