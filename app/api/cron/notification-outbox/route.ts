import { NextRequest, NextResponse } from "next/server";

import { processNotificationOutbox } from "@/lib/notifications/outbox-worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    req.headers.get("x-cron-secret") === secret
  );
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    console.warn("[notification-outbox] unauthorized cron call");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Process in waves within one invocation — backlog + slow SMTP must not stall forever.
    const total = { claimed: 0, sent: 0, failed: 0, dead: 0, skipped: 0 };
    for (let wave = 0; wave < 4; wave++) {
      const stats = await processNotificationOutbox(25);
      total.claimed += stats.claimed;
      total.sent += stats.sent;
      total.failed += stats.failed;
      total.dead += stats.dead;
      total.skipped += stats.skipped;
      if (stats.claimed === 0) break;
    }
    console.info("[notification-outbox] cron", total);
    return NextResponse.json({ ok: true, ...total });
  } catch (error) {
    console.error(
      "[notification-outbox]",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json({ error: "outbox_worker_failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
