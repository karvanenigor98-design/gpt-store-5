import { NextRequest, NextResponse } from "next/server";

import {
  resolveTelegramBotToken,
  resolveTelegramBotUsername,
  resolveTelegramChatIds,
} from "@/lib/telegram/bot-config";
import type { SiteSlug } from "@/lib/sites";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    req.headers.get("x-cron-secret") === secret
  );
}

async function tg(token: string, method: string, body?: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(15000),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const siteParam = req.nextUrl.searchParams.get("site");
  const siteSlug: SiteSlug = siteParam === "subs-store" || siteParam === "subs" ? "subs-store" : "gpt-store";
  const doSend = req.nextUrl.searchParams.get("send") === "1";

  const token = resolveTelegramBotToken(siteSlug);
  const chatId = resolveTelegramChatIds(siteSlug)[0] ?? "";
  const username = resolveTelegramBotUsername(siteSlug);

  if (!token) {
    return NextResponse.json({ ok: false, error: "token_missing", siteSlug }, { status: 500 });
  }

  const me = await tg(token, "getMe");
  const chat = chatId ? await tg(token, "getChat", { chat_id: chatId }) : null;
  let send: Record<string, unknown> | null = null;
  if (doSend && chatId) {
    send = await tg(token, "sendMessage", {
      chat_id: chatId,
      text: `✅ Probe ${siteSlug} ${new Date().toISOString()}`,
      disable_web_page_preview: true,
    });
  }

  return NextResponse.json({
    ok: true,
    siteSlug,
    username_env: username,
    token_prefix: token.split(":")[0],
    token_len: token.length,
    chatId,
    getMe: me,
    getChat: chat,
    sendMessage: send,
  });
}
