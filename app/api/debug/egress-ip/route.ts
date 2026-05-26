import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Временно: исходящий IP Vercel (fra1). Удалить после настройки Pally whitelist. */
export async function GET() {
  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `ipify HTTP ${res.status}` }, { status: 502 });
    }
    const { ip } = (await res.json()) as { ip?: string };
    return NextResponse.json({
      egressIp: ip ?? null,
      region: process.env.VERCEL_REGION ?? "fra1",
      note:
        "IP одного инвока Vercel. Для стабильной оплаты: PALLY_RELAY_URL (tools/pally-relay).",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "egress check failed" },
      { status: 500 },
    );
  }
}
