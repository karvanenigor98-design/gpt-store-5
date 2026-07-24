/**
 * Inspect recent telegram outbox rows + probe drain hosts.
 * Usage: node scripts/inspect-telegram-outbox.cjs
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

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

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const secret = process.env.CRON_SECRET?.trim();
  if (!url || !key) throw new Error("missing supabase env");

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("notification_outbox")
    .select(
      "id,channel,status,last_error,attempts,event_type,recipient,created_at,updated_at",
    )
    .eq("channel", "telegram")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  console.log("=== recent telegram outbox ===");
  for (const row of data || []) {
    console.log(
      [
        row.status,
        `att=${row.attempts}`,
        row.event_type,
        row.recipient,
        (row.last_error || "").slice(0, 140),
        row.created_at,
      ].join(" | "),
    );
  }

  if (!secret) {
    console.log("no CRON_SECRET — skip host probe");
    return;
  }

  const hosts = [
    "https://gpt-store-5.vercel.app",
    "https://gptplus-store.ru",
  ];
  console.log("\n=== cron probe ===");
  for (const host of hosts) {
    const res = await fetch(`${host}/api/cron/notification-outbox`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.text();
    console.log(host, res.status, body.slice(0, 220));
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
