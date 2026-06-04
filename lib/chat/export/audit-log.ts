import { supabaseAdmin } from "@/lib/supabase/admin";

import type { ExportAccessContext, ExportFormat } from "./types";

export async function logChatExport(params: {
  ctx: ExportAccessContext;
  exportType: ExportFormat;
  dateFrom: string | null;
  dateTo: string | null;
  messageCount: number;
  attachmentCount: number;
}): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin.from("chat_export_logs") as any).insert({
      user_id: params.ctx.userId,
      user_email: params.ctx.userEmail,
      user_role: params.ctx.userRole,
      site_slug: params.ctx.siteSlug,
      chat_id: params.ctx.chatId,
      export_type: params.exportType,
      date_from: params.dateFrom ? new Date(params.dateFrom).toISOString() : null,
      date_to: params.dateTo ? new Date(params.dateTo).toISOString() : null,
      message_count: params.messageCount,
      attachment_count: params.attachmentCount,
    });
  } catch (err) {
    console.error("[chat/export] audit log failed:", err);
  }
}
