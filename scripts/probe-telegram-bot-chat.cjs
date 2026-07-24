/**
 * Probe Telegram bot token + chat via api.telegram.org (prints no full token).
 * Usage: node scripts/probe-telegram-bot-chat.cjs [--subs]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const IS_SUBS = process.argv.includes("--subs");

function loadEnvFile(filePath) {
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
    if (!process.env[k]) process.env[k] = v;
  }
}

async function tg(token, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(20000),
  });
  return res.json();
}

async function main() {
  loadEnvFile(path.join(ROOT, ".env.local"));
  const token = IS_SUBS
    ? process.env.TELEGRAM_SUBS_BOT_TOKEN?.trim()
    : process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = IS_SUBS
    ? process.env.TELEGRAM_SUBS_ADMIN_CHAT_ID?.trim() ||
      process.env.TELEGRAM_ADMIN_CHAT_ID?.trim()
    : process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();

  if (!token) throw new Error("token missing");
  if (!chatId) throw new Error("chat id missing");

  console.log("probe", {
    mode: IS_SUBS ? "subs" : "gpt",
    token_len: token.length,
    token_prefix: token.split(":")[0],
    chatId,
  });

  const me = await tg(token, "getMe");
  console.log("getMe", me.ok ? me.result : me);

  const chat = await tg(token, "getChat", { chat_id: chatId });
  console.log("getChat", chat.ok ? { id: chat.result.id, type: chat.result.type, title: chat.result.title } : chat);

  const send = await tg(token, "sendMessage", {
    chat_id: chatId,
    text: `✅ Probe ${IS_SUBS ? "SPOTIFY" : "GPT"} ${new Date().toISOString()}`,
    disable_web_page_preview: true,
  });
  console.log("sendMessage", send.ok ? { message_id: send.result.message_id } : send);
}

main().catch((e) => {
  console.error("FAIL:", e.message || e);
  process.exit(1);
});
