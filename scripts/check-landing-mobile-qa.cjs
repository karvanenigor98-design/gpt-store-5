#!/usr/bin/env node
/** Smoke-check landing HTML for mobile overflow / key CRO strings. */
const base = process.argv[2] || "https://gpt-store-5.vercel.app";

async function fetchPath(path) {
  const url = `${base.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, { headers: { "User-Agent": "landing-mobile-qa/1.0" } });
  const html = await res.text();
  return { url, status: res.status, html };
}

function check(name, html, patterns) {
  const hits = patterns.filter((p) =>
    typeof p === "string" ? html.includes(p) : p.re.test(html),
  );
  const overflowRisk = /100vw|min-w-\[(?:1[2-9]|[2-9]\d)/.test(html);
  const projectsSection = html.includes('id="projects"') || html.includes("Наши проекты");
  console.log(`\n=== ${name} ===`);
  console.log("status patterns ok:", hits.length, "/", patterns.length);
  patterns.forEach((p) => {
    const label = typeof p === "string" ? p : p.label;
    const ok = typeof p === "string" ? html.includes(p) : p.re.test(html);
    console.log(ok ? "  ✓" : "  ✗", label);
  });
  console.log("overflow-x-hidden on main:", /overflow-x-hidden/.test(html) ? "found" : "MISSING");
  console.log("projects section:", projectsSection ? "ok" : "MISSING");
  console.log("100vw/min-w risk in HTML:", overflowRisk ? "WARN" : "none");
}

async function main() {
  const gpt = await fetchPath("/");
  const spotify = await fetchPath("/spotify");
  check("GPT STORE", gpt.html, [
    "Как выбрать тариф",
    "Подключить ChatGPT Plus",
    "Ответы на вопросы, которые обычно возникают перед оплатой",
    "Где смотреть статус заказа",
    "Наши проекты",
  ]);
  check("SPOTIFY STORE", spotify.html, [
    "SPOTIFY STORE",
    "Подключить Premium",
    { label: "no Subs Store public", re: /Subs Store/i },
    "Наши проекты",
  ]);
  if (spotify.html.match(/Subs Store/i)) {
    console.log("\nWARN: 'Subs Store' found on /spotify");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
