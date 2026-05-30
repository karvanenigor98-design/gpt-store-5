/**
 * node scripts/test-pally-bill-status-order.cjs
 */
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

const orderId = "d80eb6fc-24a0-4cd0-bd5e-d13508870421";
const amount = 440;
const secret = env.PALLY_SECRET_KEY;
const api = (env.PALLY_API_URL || "https://pally.info/api/v1").replace(/\/$/, "");
const relay = env.PALLY_RELAY_URL?.replace(/\/$/, "");

const shops = [
  { label: "GPT", id: env.PALLY_SHOP_ID || env.PALLY_SHOP_ID_GPT },
  { label: "SUBS", id: env.PALLY_SHOP_ID_SUBS },
];

async function check(label, shopId) {
  const sign = crypto.createHash("md5").update(`${shopId}:${orderId}:${amount}:${secret}`).digest("hex");
  const body = { shop_id: shopId, order_id: orderId, amount, sign };
  for (const base of [api, relay].filter(Boolean)) {
    for (const pathSuffix of ["/bill/status", "/bill/info"]) {
      const url = `${base}${pathSuffix}`;
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      };
      if (base === relay && env.PALLY_RELAY_SECRET) {
        headers["X-Pally-Relay-Secret"] = env.PALLY_RELAY_SECRET;
        headers["X-Pally-Target-Base"] = api;
      }
      try {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(20000),
        });
        const text = await res.text();
        console.log(`\n[${label}] ${url} HTTP ${res.status}`);
        console.log(text.slice(0, 400));
      } catch (e) {
        console.log(`\n[${label}] ${url} ERR`, e.message);
      }
    }
  }
}

(async () => {
  for (const s of shops) {
    if (s.id) await check(s.label, s.id);
  }
})();
