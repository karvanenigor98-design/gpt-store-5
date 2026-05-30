#!/usr/bin/env node
/** Smoke-test Pally-related public URLs on production. */
const BASE = process.env.BASE_URL || "https://gpt-store-5.vercel.app";

const cases = [
  { name: "GPT home", url: `${BASE}/`, expect: [/GPT|ChatGPT/i], status: 200 },
  { name: "Spotify home", url: `${BASE}/spotify`, expect: [/Spotify|SPOTIFY/i], status: 200 },
  { name: "GPT success", url: `${BASE}/checkout/success`, expect: [/кабинет|Подтверждаем оплату/i], status: 200 },
  { name: "GPT fail", url: `${BASE}/checkout/fail`, expect: [/Оплата не прошла|Попробовать снова/i], status: 200, links: ["/checkout", "/dashboard/orders?site=gpt-store"] },
  { name: "Spotify success", url: `${BASE}/checkout/success?site=subs-store`, expect: [/кабинет|Подтверждаем оплату/i], status: 200 },
  { name: "Spotify fail", url: `${BASE}/checkout/fail?site=subs-store`, expect: [/Оплата не прошла|SPOTIFY/i], status: 200, links: ["/checkout/spotify", "site=subs-store"] },
  { name: "Webhook GET", url: `${BASE}/api/payments/pally/webhook`, expect: [], status: 405 },
];

async function main() {
  let failed = 0;
  for (const c of cases) {
    const res = await fetch(c.url, { redirect: "follow" });
    const text = await res.text();
    const okStatus = res.status === c.status;
    const okText = c.expect.every((re) => re.test(text));
    const okLinks = (c.links || []).every((needle) => text.includes(needle));
    const ok = okStatus && okText && okLinks;
    if (!ok) failed++;
    console.log(`${ok ? "OK" : "FAIL"} ${c.name}: status=${res.status} (want ${c.status}) text=${okText} links=${okLinks} final=${res.url}`);
    if (!ok) {
      if (!okStatus) console.log("  bad status");
      if (!okText) console.log("  missing expected text");
      if (!okLinks) console.log("  missing expected links:", c.links);
    }
  }

  const wh = await fetch(`${BASE}/api/payments/pally/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: "00000000-0000-0000-0000-000000000000", status: "paid", amount: 1 }),
  });
  const whBody = await wh.text();
  const whOk = wh.status === 404 || wh.status === 200 || (wh.status === 500 && whBody.includes("error"));
  console.log(`${whOk ? "OK" : "FAIL"} Webhook POST dummy: status=${wh.status} body=${whBody.slice(0, 120)}`);
  if (!whOk) failed++;

  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
