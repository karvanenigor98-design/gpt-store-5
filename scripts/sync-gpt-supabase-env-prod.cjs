/**
 * Sync GPT Supabase env from .env.local → Vercel production/preview.
 * Deletes empty sensitive prod entries and recreates as encrypted.
 */
const fs = require("fs");
const path = require("path");
const { requireVercelToken } = require("./lib/vercel-token.cjs");

const TEAM = "team_m45ERRYeGMyCf3BMXN47Ipj3";
const PROJECT = "gpt-store-5";
const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

function parseEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local not found");
  const text = fs.readFileSync(envPath, "utf8");
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
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

async function api(token, method, apiPath, body) {
  const res = await fetch(`https://api.vercel.com${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${apiPath} → ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  const token = requireVercelToken();
  const local = parseEnvLocal();

  for (const key of KEYS) {
    if (!local[key]?.trim()) {
      console.error(`Missing ${key} in .env.local`);
      process.exit(1);
    }
  }

  const list = await api(token, "GET", `/v9/projects/${PROJECT}/env?teamId=${TEAM}`);
  const envs = list.envs || [];

  for (const key of KEYS) {
    const prodEntries = envs.filter(
      (e) => e.key === key && e.target?.includes("production"),
    );
    for (const entry of prodEntries) {
      console.log(`DELETE ${key} prod id=${entry.id} type=${entry.type}`);
      await api(token, "DELETE", `/v9/projects/${PROJECT}/env/${entry.id}?teamId=${TEAM}`);
    }

    console.log(`CREATE ${key} → production,preview (${key.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted"})`);
    const created = await api(token, "POST", `/v10/projects/${PROJECT}/env?teamId=${TEAM}`, {
      key,
      value: local[key].trim(),
      type: key.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted",
      target: ["production", "preview"],
    });
    console.log(`  ok id=${created.id || created.created?.[0]?.id || "?"}`);
  }

  // Verify dev entries still readable
  const verify = await api(
    token,
    "GET",
    `/v9/projects/${PROJECT}/env?teamId=${TEAM}&decrypt=true`,
  );
  for (const key of KEYS) {
    const prod = (verify.envs || []).find(
      (e) => e.key === key && e.target?.includes("production"),
    );
    const val = prod?.value || "";
    const okUrl = key.includes("URL") ? /\.supabase\.co/i.test(val) : val.length > 20;
    console.log(
      `VERIFY ${key}:`,
      key.includes("URL") ? (val || "EMPTY") : `len=${val.length}`,
      okUrl ? "OK" : "BAD",
    );
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
