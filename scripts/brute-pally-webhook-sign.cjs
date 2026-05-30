/**
 * node scripts/brute-pally-webhook-sign.cjs
 * Подбор формулы SignatureValue по реальному webhook из кабинета Pally.
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

const TARGET = "0392121664D57EF210819185369666B".toLowerCase();
const InvId = "d80eb6fc-24a0-4cd0-bd5e-d13508870421";
const OutSum = "440.00";
const TrsId = "G76gYXjGvx";
const Status = "SUCCESS";

const shopIds = [
  env.PALLY_SHOP_ID,
  env.PALLY_SHOP_ID_GPT,
  env.PALLY_SHOP_ID_SUBS,
  env.PALLY_SHOP_ID_SPOTIFY,
].filter(Boolean);

const secrets = [...new Set([env.PALLY_WEBHOOK_SECRET, env.PALLY_SECRET_KEY].filter(Boolean))];

const amounts = ["440.00", "440", "440,00", String(Number(OutSum)), Number(OutSum).toFixed(2)];

function md5(s) {
  return crypto.createHash("md5").update(s).digest("hex");
}

const parts = { InvId, OutSum, TrsId, Status };
const combos = [];

for (const secret of secrets) {
  for (const shopId of ["", ...shopIds]) {
    for (const amount of amounts) {
      const base = [
        `${OutSum}:${InvId}:${secret}`,
        `${InvId}:${OutSum}:${secret}`,
        `${amount}:${InvId}:${secret}`,
        `${InvId}:${amount}:${secret}`,
        `${secret}:${OutSum}:${InvId}`,
        `${secret}:${InvId}:${OutSum}`,
        `${OutSum}${InvId}${secret}`,
        `${InvId}${OutSum}${secret}`,
        `${OutSum}:${InvId}:${TrsId}:${secret}`,
        `${TrsId}:${OutSum}:${InvId}:${secret}`,
        `${Status}:${OutSum}:${InvId}:${secret}`,
        `${OutSum}:${InvId}:${Status}:${secret}`,
      ];
      if (shopId) {
        base.push(
          `${shopId}:${InvId}:${amount}:${secret}`,
          `${shopId}:${InvId}:${OutSum}:${secret}`,
          `${shopId}:${amount}:${InvId}:${secret}`,
          `${shopId}:${OutSum}:${InvId}:${secret}`,
          `${shopId}:${InvId}:${Number(amount)}:${secret}`,
          `${OutSum}:${InvId}:${shopId}:${secret}`,
        );
      }
      for (const s of base) combos.push({ formula: s.replace(secret, "<SECRET>"), hash: md5(s) });
    }
  }
}

const hits = combos.filter((c) => c.hash.toLowerCase() === TARGET);
console.log("secrets tried:", secrets.length, "shopIds:", shopIds.length);
console.log("combos:", combos.length);
if (hits.length) {
  console.log("\nMATCH:");
  for (const h of hits) console.log(h.formula, "=>", h.hash);
} else {
  console.log("\nNo match in standard formulas.");
  console.log("Sample hashes for OutSum:InvId:secret:");
  if (secrets[0]) {
    console.log(" ", md5(`${OutSum}:${InvId}:${secrets[0]}`));
    console.log(" ", md5(`${InvId}:${OutSum}:${secrets[0]}`));
  }
}
