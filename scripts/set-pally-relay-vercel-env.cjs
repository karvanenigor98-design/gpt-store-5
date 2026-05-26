/**
 * Пишет PALLY_RELAY_* в Vercel через API (нужен VERCEL_TOKEN в .env.local).
 * node scripts/set-pally-relay-vercel-env.cjs
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SETUP = path.join(ROOT, ".pally-relay-setup.local.json");
const ENV_FILE = path.join(ROOT, ".env.local");

const PROJECT = process.env.VERCEL_PROJECT_NAME || "gpt-store-5";
const TEAM = process.env.VERCEL_TEAM_SLUG || "chatgbt15";

function loadJson(p) {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadToken() {
  if (process.env.VERCEL_TOKEN?.trim()) return process.env.VERCEL_TOKEN.trim();

  const authPaths = [
    path.join(require("os").homedir(), "AppData", "Roaming", "com.vercel.cli", "Data", "auth.json"),
    path.join(require("os").homedir(), ".local-share", "com.vercel.cli", "auth.json"),
  ];
  for (const authFile of authPaths) {
    if (!fs.existsSync(authFile)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(authFile, "utf8"));
      const token = data.token || data.credentials?.[0]?.token;
      if (token) return token;
    } catch {
      /* next */
    }
  }

  if (!fs.existsSync(ENV_FILE)) return null;
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith("VERCEL_TOKEN=")) {
      return t.slice("VERCEL_TOKEN=".length).replace(/^["']|["']$/g, "").trim();
    }
  }
  return null;
}

async function api(method, urlPath, body) {
  const token = loadToken();
  if (!token) {
    console.error("Нет VERCEL_TOKEN. Добавь в .env.local или env.");
    console.error("https://vercel.com/account/tokens");
    process.exit(1);
  }
  const res = await fetch(`https://api.vercel.com${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    console.error("Vercel API error:", res.status, json);
    process.exit(1);
  }
  return json;
}

async function upsertEnv(key, value, target) {
  return api("POST", `/v10/projects/${PROJECT}/env?teamId=${TEAM}`, {
    key,
    value,
    type: "encrypted",
    target: [target],
  });
}

async function main() {
  const setup = loadJson(SETUP);
  if (!setup?.PALLY_RELAY_SECRET) {
    console.error("Сначала: node scripts/setup-pally-relay-complete.cjs");
    process.exit(1);
  }

  const relayUrl =
    process.env.PALLY_RELAY_URL?.trim() ||
    setup.PALLY_RELAY_URL_deployed ||
    setup.PALLY_RELAY_URL_fly;

  console.log("Vercel project:", PROJECT, "team:", TEAM);
  console.log("PALLY_RELAY_URL:", relayUrl);

  await upsertEnv("PALLY_RELAY_URL", relayUrl, "production");
  await upsertEnv("PALLY_RELAY_SECRET", setup.PALLY_RELAY_SECRET, "production");

  console.log("\nOK: PALLY_RELAY_URL + PALLY_RELAY_SECRET → production");
  console.log("Redeploy: git push или Vercel Dashboard → Redeploy");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
