/**
 * Генерирует секрет relay + файл с инструкцией для Vercel/Pally.
 * node scripts/setup-pally-relay-complete.cjs
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, ".pally-relay-setup.local.json");

const secret = crypto.randomBytes(24).toString("hex");
const relayAppName = "gpt-store-pally-relay";
const relayUrlFly = `https://${relayAppName}.fly.dev`;

const data = {
  generatedAt: new Date().toISOString(),
  PALLY_RELAY_SECRET: secret,
  PALLY_RELAY_URL_fly: relayUrlFly,
  PALLY_RELAY_URL_vps_note:
    "Если relay на VPS 195.200.16.222 — укажите https://pay.ваш-домен.ru после nginx/tunnel",
  vercelProject: "gpt-store-5",
  vercelAppUrl: "https://gpt-store-5.vercel.app",
};

fs.writeFileSync(OUT, JSON.stringify(data, null, 2), "utf8");

console.log("\n=== Pally Relay — сгенерировано ===\n");
console.log("Файл:", OUT);
console.log("\nPALLY_RELAY_SECRET (скопируй в Fly + Vercel):\n");
console.log(secret);
console.log("\nПосле деплоя Fly URL для Vercel:\n");
console.log(relayUrlFly);
console.log("\nДальше:");
console.log("  1) node scripts/deploy-pally-relay-fly.cjs   (или setup на VPS)");
console.log("  2) node scripts/set-pally-relay-vercel-env.cjs");
console.log("  3) Только ты: один IP в Pally whitelist (см. PALLY-YOU-DO-THIS.md)\n");
