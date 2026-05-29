const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
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

const setup = JSON.parse(fs.readFileSync(path.join(ROOT, ".pally-relay-setup.local.json"), "utf8"));
const shopId = env.PALLY_SHOP_ID;
const secret = env.PALLY_SECRET_KEY;
const orderId = `test-${Date.now()}`;
const amount = 2090;
const sign = crypto.createHash("md5").update(`${shopId}:${orderId}:${amount}:${secret}`).digest("hex");
const appUrl = "https://gpt-store-5.vercel.app";

const body = {
  shop_id: shopId,
  order_id: orderId,
  amount,
  currency: "RUB",
  desc: "GPT STORE test",
  success_url: `${appUrl}/checkout/success`,
  fail_url: `${appUrl}/checkout/fail`,
  webhook_url: `${appUrl}/api/payments/pally/webhook`,
  sign,
  test: 0,
};

async function post(label, url, headers) {
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  console.log(`\n=== ${label} ===`);
  console.log("status:", res.status);
  console.log(text.slice(0, 600));
}

(async () => {
  const relay = setup.PALLY_RELAY_URL;
  const relaySecret = setup.PALLY_RELAY_SECRET;
  await post(
    "direct",
    "https://pally.info/api/v1/bill/create",
    { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
  );
  await post("relay", `${relay}/bill/create`, {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
    "X-Pally-Relay-Secret": relaySecret,
    "X-Pally-Target-Base": "https://pally.info/api/v1",
  });
})();
