/**
 * Smoke-check prod after orders deploy.
 */
const https = require("https");

const BASE = "https://gpt-store-5.vercel.app";

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve({ status: res.statusCode, body: d, headers: res.headers }));
      })
      .on("error", reject);
  });
}

(async () => {
  const checks = [];

  for (const path of ["/", "/spotify", "/dashboard/orders?site=subs-store", "/checkout/success?site=subs-store"]) {
    const r = await get(`${BASE}${path}`);
    checks.push({ path, status: r.status, ok: r.status >= 200 && r.status < 400 });
  }

  const ordersHtml = (await get(`${BASE}/dashboard/orders?site=subs-store&highlightOrder=test`)).body;
  const homeHtml = (await get(`${BASE}/`)).body;

  const chunkMatch = homeHtml.match(/\/_next\/static\/chunks\/app\/\(dashboard\)\/dashboard\/orders\/page-[^"']+\.js/);
  let ordersChunkHas = { highlightOrder: false, paidLabel: false, completePay: false };
  if (chunkMatch) {
    const js = (await get(`${BASE}${chunkMatch[0]}`)).body;
    ordersChunkHas = {
      highlightOrder: js.includes("highlightOrder"),
      paidLabel: js.includes("Оплата получена"),
      completePay: js.includes("Завершить оплату"),
    };
  }

  const webhook = await get(`${BASE}/api/payments/pally/webhook`);
  checks.push({
    path: "POST /api/payments/pally/webhook (GET probe)",
    status: webhook.status,
    ok: webhook.status === 405 || webhook.status === 404 || webhook.status === 200,
  });

  console.log(JSON.stringify({ checks, ordersChunkHas, ordersHtmlHasHighlight: ordersHtml.includes("highlightOrder") }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
