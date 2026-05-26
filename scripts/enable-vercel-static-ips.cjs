/**
 * Включает Vercel Static IPs для проекта (регион fra1) и печатает IP для whitelist Pally.
 *
 * Требования: Pro/Enterprise, ~$100/мес за Static IPs на проект.
 * Токен: VERCEL_TOKEN или auth.json от `vercel login`.
 *
 * Usage: node scripts/enable-vercel-static-ips.cjs [--dry-run] [--project gpt-store-5] [--team chatgbt15]
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const DRY = process.argv.includes("--dry-run");
const projectIdx = process.argv.indexOf("--project");
const teamIdx = process.argv.indexOf("--team");
const PROJECT = projectIdx >= 0 ? process.argv[projectIdx + 1] : "gpt-store-5";
const TEAM_SLUG = teamIdx >= 0 ? process.argv[teamIdx + 1] : "chatgbt15";
const REGION = "fra1";

function readVercelToken() {
  if (process.env.VERCEL_TOKEN?.trim()) return process.env.VERCEL_TOKEN.trim();

  const candidates = [
    path.join(os.homedir(), "AppData", "Roaming", "com.vercel.cli", "Data", "auth.json"),
    path.join(os.homedir(), ".local-share", "com.vercel.cli", "auth.json"),
  ];

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      const token = data.token || data.credentials?.[0]?.token;
      if (token) return token;
    } catch {
      /* next */
    }
  }
  return null;
}

async function vercelApi(method, apiPath, body) {
  const token = readVercelToken();
  if (!token) {
    console.error("Нет VERCEL_TOKEN. Выполните: npx vercel login");
    process.exit(1);
  }

  const url = new URL(`https://api.vercel.com${apiPath}`);
  url.searchParams.set("teamId", TEAM_SLUG);

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
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  return { ok: res.ok, status: res.status, json };
}

function collectIps(payload) {
  const ips = new Set();
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    for (const [key, val] of Object.entries(node)) {
      if (typeof val === "string" && /^\d{1,3}(\.\d{1,3}){3}$/.test(val)) {
        ips.add(val);
      }
      if (key.toLowerCase().includes("ip") && typeof val === "string" && val.includes(".")) {
        val.split(/[\s,;]+/).forEach((part) => {
          if (/^\d{1,3}(\.\d{1,3}){3}$/.test(part)) ips.add(part);
        });
      }
      walk(val);
    }
  };
  walk(payload);
  return [...ips];
}

async function main() {
  console.log(`Project: ${PROJECT}, team: ${TEAM_SLUG}, region: ${REGION}`);

  const getPath = `/v1/projects/${encodeURIComponent(PROJECT)}/shared-connect-links`;
  const before = await vercelApi("GET", getPath);
  if (before.ok) {
    console.log("Current Static IPs config:");
    console.log(JSON.stringify(before.json, null, 2));
    const existing = collectIps(before.json);
    if (existing.length) {
      console.log("\nIP addresses (add to Pally whitelist):");
      existing.forEach((ip) => console.log(`  - ${ip}`));
    }
  } else if (before.status !== 404) {
    console.warn(`GET shared-connect-links: HTTP ${before.status}`);
    console.warn(JSON.stringify(before.json, null, 2));
  }

  const body = { regions: [REGION], builds: true };
  if (DRY) {
    console.log("\n[dry-run] Would PATCH:", JSON.stringify(body));
    return;
  }

  console.log("\nEnabling Static IPs for fra1...");
  const patch = await vercelApi("PATCH", getPath, body);

  if (!patch.ok) {
    console.error(`PATCH failed: HTTP ${patch.status}`);
    console.error(JSON.stringify(patch.json, null, 2));
    if (patch.status === 402 || patch.status === 403) {
      console.error(
        "\nВозможные причины: нет Pro/Enterprise, не подключён add-on Static IPs ($100/мес), или нет прав на team.",
      );
      console.error("Альтернатива: в Pally отключите фильтр по IP (бесплатно).");
    }
    process.exit(1);
  }

  console.log("Static IPs enabled. Response:");
  console.log(JSON.stringify(patch.json, null, 2));

  const after = await vercelApi("GET", getPath);
  const ips = collectIps(after.ok ? after.json : patch.json);
  if (ips.length) {
    console.log("\n=== Добавьте в Pally → настройки магазина → whitelist IP ===");
    ips.forEach((ip) => console.log(ip));
    console.log("\nПосле сохранения в Pally: Vercel → Redeploy production.");
  } else {
    console.log(
      "\nIP не найдены в ответе API. Откройте Vercel → Project → Settings → Connectivity → скопируйте IP fra1 в Pally.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
