/**
 * Patch Telegram env on VPS from .env.local (no token print).
 * Usage: node scripts/patch-vps-telegram-env.cjs
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const KEY = process.env.VPS_SSH_KEY || path.join(ROOT, ".vps-deploy-key");
const HOST = process.env.VPS_HOST || "5.129.221.84";
const USER = process.env.VPS_USER || "root";
const ENV_PATH = "/opt/gpt-store-5/.env.production";

function loadLocal() {
  const p = path.join(ROOT, ".env.local");
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return out;
}

function main() {
  if (!fs.existsSync(KEY)) {
    console.error("NO_KEY", KEY);
    process.exit(2);
  }
  const local = loadLocal();
  const want = {
    TELEGRAM_BOT_TOKEN: local.TELEGRAM_BOT_TOKEN?.trim(),
    TELEGRAM_ADMIN_CHAT_ID: local.TELEGRAM_ADMIN_CHAT_ID?.trim(),
    TELEGRAM_BOT_USERNAME: local.TELEGRAM_BOT_USERNAME?.trim(),
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: local.TELEGRAM_BOT_USERNAME?.trim(),
    TELEGRAM_SUBS_BOT_TOKEN: local.TELEGRAM_SUBS_BOT_TOKEN?.trim(),
    TELEGRAM_SUBS_ADMIN_CHAT_ID: local.TELEGRAM_SUBS_ADMIN_CHAT_ID?.trim(),
    TELEGRAM_SUBS_BOT_USERNAME: local.TELEGRAM_SUBS_BOT_USERNAME?.trim(),
  };
  for (const k of Object.keys(want)) {
    if (!want[k]) delete want[k];
  }
  if (!want.TELEGRAM_BOT_TOKEN || !want.TELEGRAM_ADMIN_CHAT_ID) {
    console.error("missing TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID in .env.local");
    process.exit(1);
  }

  const remoteJs = `
const fs = require("fs");
const ENV = ${JSON.stringify(ENV_PATH)};
const WANT = ${JSON.stringify(want)};
let raw = fs.readFileSync(ENV, "utf8");
const lines = raw.split(/\\r?\\n/);
const seen = new Set();
const next = lines.map((line) => {
  const m = line.match(/^([A-Z0-9_]+)=/);
  if (!m || !(m[1] in WANT)) return line;
  seen.add(m[1]);
  return m[1] + "=" + WANT[m[1]];
});
for (const [k, v] of Object.entries(WANT)) {
  if (!seen.has(k)) next.push(k + "=" + v);
}
fs.writeFileSync(ENV, next.join("\\n"));
console.log("vps_telegram_env_updated", {
  gpt_chat: WANT.TELEGRAM_ADMIN_CHAT_ID,
  gpt_bot: WANT.TELEGRAM_BOT_USERNAME,
  subs_chat: WANT.TELEGRAM_SUBS_ADMIN_CHAT_ID || null,
  subs_bot: WANT.TELEGRAM_SUBS_BOT_USERNAME || null,
  gpt_token_len: WANT.TELEGRAM_BOT_TOKEN.length,
  subs_token_len: WANT.TELEGRAM_SUBS_BOT_TOKEN ? WANT.TELEGRAM_SUBS_BOT_TOKEN.length : 0,
});
`;

  const b64 = Buffer.from(remoteJs, "utf8").toString("base64");
  const ssh = spawnSync(
    "ssh",
    [
      "-i",
      KEY,
      "-o",
      "StrictHostKeyChecking=no",
      "-o",
      "ConnectTimeout=20",
      `${USER}@${HOST}`,
      `echo ${b64} | base64 -d > /tmp/patch-tg-env.cjs && node /tmp/patch-tg-env.cjs && pm2 restart gpt-store --update-env && pm2 save`,
    ],
    { encoding: "utf8" },
  );
  process.stdout.write(ssh.stdout || "");
  process.stderr.write(ssh.stderr || "");
  process.exit(ssh.status || 0);
}

main();
