/**
 * Post-deploy smoke: prod HTML + subs notification API probe (service role).
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ENV_LOCAL = path.join(ROOT, ".env.local");
const BASE = "https://gpt-store-5.vercel.app";

function parseEnvLocal() {
  const out = {};
  if (!fs.existsSync(ENV_LOCAL)) return out;
  for (const line of fs.readFileSync(ENV_LOCAL, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, eq).trim()] = val;
  }
  return out;
}

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "GET",
        headers,
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve({ status: res.statusCode, body: d }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function subsGet(path, key) {
  const env = parseEnvLocal();
  const base = (env.SUBS_SUPABASE_URL || env.NEXT_PUBLIC_SUBS_SUPABASE_URL || "").replace(/\/$/, "");
  return get(`${base}/rest/v1/${path}`, {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  });
}

(async () => {
  const env = parseEnvLocal();
  const subsKey = env.SUBS_SUPABASE_SERVICE_ROLE_KEY;
  const results = { base: BASE, checks: {} };

  const gptSnippet = "Спасибо за оперативное подключение";
  const subsSnippet = "smoke-тест публикации отзыва";

  const [home, spotify] = await Promise.all([get(`${BASE}/`), get(`${BASE}/spotify`)]);
  results.checks.homeStatus = home.status;
  results.checks.spotifyStatus = spotify.status;
  results.checks.gptReviewOnHome = home.body.includes(gptSnippet);
  results.checks.subsReviewOnSpotify = spotify.body.includes(subsSnippet);

  if (subsKey) {
    const notifRes = await subsGet(
      "notifications?select=id,title,type,is_read&recipient_user_id=is.null&type=eq.smoke_test&order=created_at.desc&limit=3",
      subsKey,
    );
    results.checks.subsSmokeNotificationApi =
      notifRes.status === 200 && notifRes.body.includes("SMOKE cross-site");
  } else {
    results.checks.subsSmokeNotificationApi = "skipped_no_key";
  }

  const ordersPage = await get(`${BASE}/admin/orders?site=subs-store`);
  results.checks.adminOrdersStatus = ordersPage.status;
  results.checks.ordersHasStaffOrderChatLink =
    ordersPage.body.includes("StaffOrderChatLink") ||
    ordersPage.body.includes("client_email=") ||
    ordersPage.body.includes("/admin/chat?");

  console.log(JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
