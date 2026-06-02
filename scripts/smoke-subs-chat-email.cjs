/**
 * Smoke: subs-store chat session resolution for email-only order (DB-level, same as API).
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const ENV = path.join(__dirname, "..", ".env.local");

function env() {
  const out = {};
  for (const line of fs.readFileSync(ENV, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[t.slice(0, eq).trim()] = v;
  }
  return out;
}

function restGet(base, key, queryPath) {
  return new Promise((resolve, reject) => {
    const u = new URL(`${base.replace(/\/$/, "")}/rest/v1/${queryPath}`);
    https
      .get(
        u,
        { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" } },
        (res) => {
          let d = "";
          res.on("data", (c) => (d += c));
          res.on("end", () => resolve({ status: res.statusCode, body: d }));
        },
      )
      .on("error", reject);
  });
}

(async () => {
  const e = env();
  const base = e.SUBS_SUPABASE_URL;
  const key = e.SUBS_SUPABASE_SERVICE_ROLE_KEY;
  const orderId = "24bf4065-ffb2-4f5e-8f42-71701a542448";
  const orderRes = await restGet(
    base,
    key,
    `orders?id=eq.${orderId}&select=id,user_id,customer_email`,
  );
  const order = JSON.parse(orderRes.body)[0];
  const email = String(order?.customer_email || "")
    .trim()
    .toLowerCase()
    .replace(/[\u200e\u200f]/g, "");

  const profileRes = await restGet(base, key, `profiles?email=ilike.${encodeURIComponent(email)}&select=id&limit=1`);
  const profiles = JSON.parse(profileRes.body);
  const byOrderRes = await restGet(
    base,
    key,
    `orders?customer_email=ilike.${encodeURIComponent(email)}&user_id=not.is.null&select=user_id&order=created_at.desc&limit=1`,
  );
  const byOrder = JSON.parse(byOrderRes.body);

  const resolved =
    profiles[0]?.id ?? byOrder[0]?.user_id ?? null;

  console.log(
    JSON.stringify(
      {
        orderId,
        email,
        user_id_on_order: order?.user_id ?? null,
        resolvedUserId: resolved,
        chatWouldOpen: Boolean(resolved),
        note: resolved
          ? "API /api/admin/chat/session can open thread"
          : "email-only order without profile — chat link shows but session API returns 400 until guest flow exists",
      },
      null,
      2,
    ),
  );
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
