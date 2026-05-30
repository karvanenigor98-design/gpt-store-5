/**
 * node scripts/test-pally-webhook-sign.cjs
 * Проверка подписи по реальному webhook из кабинета Pally.
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

const secret = env.PALLY_SECRET_KEY;
const OutSum = "440.00";
const InvId = "d80eb6fc-24a0-4cd0-bd5e-d13508870421";
const expected = "0392121664D57EF210819185369666B";

const got = crypto.createHash("md5").update(`${OutSum}:${InvId}:${secret}`).digest("hex");
const ok = got.toLowerCase() === expected.toLowerCase();

console.log("formula: MD5(OutSum:InvId:PALLY_SECRET_KEY)");
console.log("match:", ok ? "YES" : "NO");
if (!ok) console.log("expected:", expected.toLowerCase(), "got:", got);
