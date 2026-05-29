/**
 * node scripts/test-pally-both-shops.cjs
 * Проверка bill/create для GPT и Spotify shop_id.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const envPath = path.join(ROOT, ".env.local");
const env = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[t.slice(0, i).trim()] = v;
  }
}

const secretKey = env.PALLY_SECRET_KEY || "";
const apiBase = (env.PALLY_API_URL || "https://pally.info/api/v1").replace(/\/$/, "");
const relayUrl = env.PALLY_RELAY_URL?.trim().replace(/\/$/, "");
const relaySecret = env.PALLY_RELAY_SECRET?.trim() || "";

const shops = [
  { label: "GPT", shopId: env.PALLY_SHOP_ID || env.PALLY_SHOP_ID_GPT },
  { label: "SPOTIFY", shopId: env.PALLY_SHOP_ID_SUBS || env.PALLY_SHOP_ID_SPOTIFY },
];

async function postBill(label, shopId) {
  if (!shopId) {
    console.log(`[${label}] SKIP: shop id пустой`);
    return;
  }
  const orderId = `test-${label.toLowerCase()}-${Date.now()}`;
  const amount = 100;
  const sign = crypto.createHash("md5").update(`${shopId}:${orderId}:${amount}:${secretKey}`).digest("hex");
  const body = {
    shop_id: shopId,
    order_id: orderId,
    amount,
    currency: "RUB",
    desc: `test ${label}`,
    sign,
    test: env.PALLY_TEST_MODE === "true" ? 1 : 0,
  };

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${secretKey}`,
  };

  let url = `${apiBase}/bill/create`;
  if (relayUrl) {
    url = `${relayUrl}/bill/create`;
    if (relaySecret) headers["X-Pally-Relay-Secret"] = relaySecret;
    headers["X-Pally-Target-Base"] = apiBase;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  console.log(`\n=== ${label} shop=${shopId} ===`);
  console.log("HTTP", res.status);
  console.log(text.slice(0, 500));
}

(async () => {
  if (!secretKey) {
    console.error("Нет PALLY_SECRET_KEY в .env.local");
    process.exit(1);
  }
  for (const s of shops) {
    await postBill(s.label, s.shopId);
  }
})();
