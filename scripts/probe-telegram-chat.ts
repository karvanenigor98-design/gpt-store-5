/**
 * Probe Telegram chat_id without printing secrets.
 * Usage: npx tsx scripts/probe-telegram-chat.ts
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
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  if (!token || !chatId) throw new Error("missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID");

  console.log("chat_id_prefix", chatId.slice(0, 4) + "…");
  console.log("chat_id_len", chatId.length);

  const getChat = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId }),
    signal: AbortSignal.timeout(15_000),
  });
  const getBody = await getChat.text();
  console.log("getChat_status", getChat.status);
  console.log("getChat_ok", getBody.includes('"ok":true'));
  if (!getBody.includes('"ok":true')) {
    console.log("getChat_error_code", (getBody.match(/"error_code":(\d+)/) || [])[1] || "?");
    console.log(
      "getChat_description",
      (getBody.match(/"description":"([^"]+)"/) || [])[1] || getBody.slice(0, 160),
    );
  }

  const send = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `Probe OK ${new Date().toISOString()}`,
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const sendBody = await send.text();
  console.log("send_status", send.status);
  console.log("send_ok", sendBody.includes('"ok":true'));
  if (!sendBody.includes('"ok":true')) {
    console.log(
      "send_description",
      (sendBody.match(/"description":"([^"]+)"/) || [])[1] || sendBody.slice(0, 160),
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
