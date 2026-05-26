/**
 * Собирает egress IP продакшена (fra1) — добавь все в Pally whitelist (временный фикс).
 * node scripts/print-vercel-pally-egress.cjs
 */
const APP = process.env.NEXT_PUBLIC_APP_URL || "https://gpt-store-5.vercel.app";

async function main() {
  const ips = new Set();
  for (let i = 0; i < 8; i++) {
    try {
      const res = await fetch(`${APP}/api/debug/egress-ip`, {
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      });
      if (res.ok) {
        const j = await res.json();
        if (j.egressIp) ips.add(j.egressIp);
      }
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log("Pally → магазин → IP Whitelist → добавь ВСЕ:\n");
  if (!ips.size) {
    console.log("(не удалось получить IP — открой", `${APP}/api/debug/egress-ip`, ")");
    process.exit(1);
  }
  for (const ip of ips) console.log(ip);
  console.log("\nЛучше: relay на VPS (195.200.16.222) → tools/pally-relay/setup-vps-cloudflared.sh");
}

main();
