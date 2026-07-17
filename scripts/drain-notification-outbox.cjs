/**
 * Drain production notification_outbox via authenticated cron endpoint.
 * Usage: node scripts/drain-notification-outbox.cjs
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function loadEnvFile(filePath, override = false) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (override || !process.env[k]) process.env[k] = v;
  }
}

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env.vercel.production.local"), true);

const secret = process.env.CRON_SECRET?.trim();
const base = process.env.PROD_APP_URL || "https://gptplus-store.ru";

async function main() {
  if (!secret) throw new Error("CRON_SECRET empty");
  const total = { claimed: 0, sent: 0, failed: 0, dead: 0, skipped: 0 };
  for (let i = 0; i < 50; i++) {
    const res = await fetch(`${base}/api/cron/notification-outbox`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`cron ${res.status}: ${text}`);
    const j = JSON.parse(text);
    total.claimed += j.claimed || 0;
    total.sent += j.sent || 0;
    total.failed += j.failed || 0;
    total.dead += j.dead || 0;
    total.skipped += j.skipped || 0;
    console.log(`pass ${i + 1}`, j);
    if ((j.claimed || 0) === 0) break;
  }
  console.log("TOTAL", total);
}

main().catch((e) => {
  console.error("FAIL:", e.message || e);
  process.exit(1);
});
