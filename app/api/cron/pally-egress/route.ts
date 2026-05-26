import { NextResponse } from "next/server";

import { detectEgressIp } from "@/lib/payments/pally-http";
import { notifyOperationalFailure } from "@/lib/telegram/notifications";

export const maxDuration = 30;

/** Vercel Cron: фиксирует egress IP и шлёт в Telegram при смене (для Pally whitelist). */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = await detectEgressIp();
  if (!ip) {
    return NextResponse.json({ ok: false, error: "egress detect failed" }, { status: 500 });
  }

  const prev = process.env.PALLY_LAST_EGRESS_IP?.trim();
  if (prev && prev !== ip) {
    await notifyOperationalFailure({
      context: "Pally: сменился egress IP Vercel (fra1)",
      detail: `Было: ${prev}\nСтало: ${ip}\nДобавь ${ip} в Pally whitelist или задеплой relay (tools/pally-relay/setup-vps-cloudflared.sh).`,
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    egressIp: ip,
    region: "fra1",
    changed: Boolean(prev && prev !== ip),
    note: "Добавь IP в Pally или используй PALLY_RELAY_URL",
  });
}
