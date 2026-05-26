/**
 * Vercel env через API. Нужен свежий токен:
 * https://vercel.com/account/tokens → Create → в .env.local: VERCEL_TOKEN=...
 *
 * node scripts/vercel-set-pally-relay-env.cjs --url https://xxxx.trycloudflare.com
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env.local");
const SETUP = path.join(ROOT, ".pally-relay-setup.local.json");

const PROJECT = process.env.VERCEL_PROJECT_NAME || "gpt-store-5";
const TEAM = process.env.VERCEL_TEAM_SLUG || "chatgbt15";

function loadToken() {
  if (process.env.VERCEL_TOKEN?.trim()) return process.env.VERCEL_TOKEN.trim();
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
    console.error("Нет VERCEL_TOKEN. Создай: https://vercel.com/account/tokens");
    console.error("Добавь в .env.local: VERCEL_TOKEN=...");
    process.exit(1);
  }
  const url = new URL(`https://api.vercel.com${urlPath}`);
  if (TEAM) url.searchParams.set("teamId", TEAM);
  const res = await fetch(url, {
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
  return { ok: res.ok, status: res.status, json };
}

async function upsertEnv(key, value) {
  return api("POST", `/v10/projects/${PROJECT}/env`, {
    key,
    value,
    type: "encrypted",
    target: ["production"],
  });
}

async function main() {
  const urlIdx = process.argv.indexOf("--url");
  const relayUrl = urlIdx >= 0 ? process.argv[urlIdx + 1]?.trim() : process.env.PALLY_RELAY_URL?.trim();
  if (!relayUrl) {
    console.error("Укажи URL: node scripts/vercel-set-pally-relay-env.cjs --url https://....trycloudflare.com");
    process.exit(1);
  }

  const setup = fs.existsSync(SETUP) ? JSON.parse(fs.readFileSync(SETUP, "utf8")) : null;
  const secret = setup?.PALLY_RELAY_SECRET || process.env.PALLY_RELAY_SECRET;
  if (!secret) {
    console.error("Нет PALLY_RELAY_SECRET");
    process.exit(1);
  }

  console.log("Project:", PROJECT, "team:", TEAM);
  console.log("PALLY_RELAY_URL:", relayUrl);

  for (const [key, value] of [
    ["PALLY_RELAY_URL", relayUrl],
    ["PALLY_RELAY_SECRET", secret],
  ]) {
    const r = await upsertEnv(key, value);
    if (!r.ok) {
      console.error(`FAIL ${key}:`, r.status, r.json);
      if (r.status === 403) {
        console.error("\nТокен устарел. Новый: https://vercel.com/account/tokens");
        console.error("Или вручную: Vercel → gpt-store-5 → Environment Variables");
      }
      process.exit(1);
    }
    console.log("OK", key);
  }

  console.log("\nRedeploy: Vercel Dashboard → Deployments → Redeploy");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
