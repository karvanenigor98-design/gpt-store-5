/**
 * node scripts/test-pally-connect.cjs
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const envPath = path.join(__dirname, "..", ".env.local");
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

const shopId = env.PALLY_SHOP_ID || "";
const secretKey = env.PALLY_SECRET_KEY || "";
const bases = [
  "https://pally.info/api/v1",
  "https://api.pally.info/v1",
  (env.PALLY_API_URL || "").replace(/\/$/, ""),
].filter(Boolean);

async function tryCreate(base) {
  const orderId = `test-${Date.now()}`;
  const amount = 100;
  const sign = crypto
    .createHash("md5")
    .update(`${shopId}:${orderId}:${amount}:${secretKey}`)
    .digest("hex");
  const body = {
    shop_id: shopId,
    order_id: orderId,
    amount,
    currency: "RUB",
    desc: "test",
    sign,
    test: 1,
  };
  const url = `${base.replace(/\/$/, "")}/bill/create`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secretKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.status + " " + (await res.text()).slice(0, 200);
  return { url, text };
}

(async () => {
  console.log("shop:", shopId ? "set" : "MISSING", "secret:", secretKey ? "set" : "MISSING");
  for (const base of [...new Set(bases)]) {
    try {
      const r = await tryCreate(base);
      console.log("OK", r.url, "->", r.text);
    } catch (e) {
      console.log("FAIL", base, e.message);
    }
  }
})();
