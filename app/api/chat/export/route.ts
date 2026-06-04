import { NextRequest, NextResponse } from "next/server";

import { logChatExport } from "@/lib/chat/export/audit-log";
import { verifyChatExportAccess } from "@/lib/chat/export/access";
import { buildAttachmentsOnlyZip, buildChatExportZip } from "@/lib/chat/export/build-zip";
import { buildChatExportHtml, buildExportFilename, buildExportPayload } from "@/lib/chat/export/build-html";
import type { ExportFormat } from "@/lib/chat/export/types";
import type { SiteSlug } from "@/lib/sites";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseFormat(value: string | null): ExportFormat {
  if (value === "zip" || value === "attachments") return value;
  return "html";
}

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chat_id")?.trim();
  const siteParam = req.nextUrl.searchParams.get("site")?.trim() ?? "gpt-store";
  const format = parseFormat(req.nextUrl.searchParams.get("format"));
  const dateFrom = req.nextUrl.searchParams.get("date_from");
  const dateTo = req.nextUrl.searchParams.get("date_to");

  if (!chatId) {
    return NextResponse.json({ error: "chat_id обязателен" }, { status: 400 });
  }

  const siteSlug: SiteSlug = siteParam === "subs-store" ? "subs-store" : "gpt-store";

  const access = await verifyChatExportAccess({ siteSlug, chatId });
  if (access instanceof NextResponse) return access;

  try {
    const payload = await buildExportPayload({
      siteSlug,
      chatId,
      dateFrom,
      dateTo,
    });

    if (format === "attachments") {
      if (payload.meta.attachmentCount === 0) {
        return NextResponse.json({ error: "В этом чате нет файлов", code: "no_files" }, { status: 404 });
      }
      const zipResult = await buildAttachmentsOnlyZip(payload);
      if (!zipResult) {
        return NextResponse.json({ error: "Не удалось скачать файлы" }, { status: 500 });
      }

      await logChatExport({
        ctx: access,
        exportType: "attachments",
        dateFrom,
        dateTo,
        messageCount: payload.meta.messageCount,
        attachmentCount: payload.meta.attachmentCount,
      });

      return new NextResponse(new Uint8Array(zipResult.buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${zipResult.filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (format === "zip") {
      const zipResult = await buildChatExportZip(payload);

      await logChatExport({
        ctx: access,
        exportType: "zip",
        dateFrom,
        dateTo,
        messageCount: payload.meta.messageCount,
        attachmentCount: payload.meta.attachmentCount,
      });

      return new NextResponse(new Uint8Array(zipResult.buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${zipResult.filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const html = buildChatExportHtml(payload, false);
    const filename = buildExportFilename(payload, "html");

    await logChatExport({
      ctx: access,
      exportType: "html",
      dateFrom,
      dateTo,
      messageCount: payload.meta.messageCount,
      attachmentCount: payload.meta.attachmentCount,
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[chat/export]", err);
    return NextResponse.json({ error: "Не удалось сформировать экспорт" }, { status: 500 });
  }
}
