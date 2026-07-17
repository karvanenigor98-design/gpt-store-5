/**
 * Drain notification_outbox using local worker + .env.local providers.
 * Usage: npx tsx scripts/run-outbox-worker-local.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const filePath = resolve(process.cwd(), ".env.local");
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
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
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

async function main() {
  const { processNotificationOutbox } = await import(
    "../lib/notifications/outbox-worker"
  );

  const total = { claimed: 0, sent: 0, failed: 0, dead: 0, skipped: 0 };
  for (let i = 0; i < 30; i++) {
    const stats = await processNotificationOutbox(25);
    total.claimed += stats.claimed;
    total.sent += stats.sent;
    total.failed += stats.failed;
    total.dead += stats.dead;
    total.skipped += stats.skipped;
    console.log(`pass ${i + 1}`, stats);
    if (stats.claimed === 0) break;
  }
  console.log("TOTAL", total);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
