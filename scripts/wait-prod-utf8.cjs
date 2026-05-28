const https = require("https");

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(d));
      })
      .on("error", reject);
  });
}

async function check() {
  const html = await get("https://gpt-store-5.vercel.app/");
  const chunk = html.match(/\/_next\/static\/chunks\/5604-[^"']+\.js/)?.[0];
  if (!chunk) return { ok: false, reason: "no chunk" };
  const js = await get("https://gpt-store-5.vercel.app" + chunk);
  const good = js.includes("Чат поддержки");
  const bad =
    js.includes("Р§Р°С‚") ||
    js.includes("РїРѕРґРґРµСЂР¶РєРё") ||
    /РїРѕРґРґР/.test(js) ||
    /Р§Р°С/.test(js);
  return { ok: good && !bad, chunk, good, bad };
}

(async () => {
  const max = 12;
  for (let i = 1; i <= max; i++) {
    try {
      const r = await check();
      console.log(`[${i}/${max}]`, r);
      if (r.ok) {
        console.log("READY: https://gpt-store-5.vercel.app");
        process.exit(0);
      }
    } catch (e) {
      console.log(`[${i}/${max}] error`, e.message);
    }
    await new Promise((r) => setTimeout(r, 30000));
  }
  console.log("TIMEOUT — check Vercel dashboard");
  process.exit(1);
})();
