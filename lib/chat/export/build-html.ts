import { escapeHtml, sanitizeFilenamePart } from "./escape";
import {
  buildExportPayload,
  formatExportTime,
  groupMessagesByDate,
  replyBlockHtml,
} from "./fetch-data";
import type { ExportMessage, ExportPayload } from "./types";

function attachmentHtml(att: ExportMessage["attachmentsList"][number], useRelativePaths: boolean): string {
  const name = escapeHtml(att.name);
  const type = escapeHtml(att.type);
  const href = useRelativePaths && att.zipPath ? escapeHtml(att.zipPath) : escapeHtml(att.url);
  const isImage = att.type.startsWith("image/");
  const isVideo = att.type.startsWith("video/");

  let preview = "";
  if (isImage) {
    preview = `<div class="attachment-preview"><img src="${href}" alt="${name}" loading="lazy"/></div>`;
  } else if (isVideo) {
    preview = `<div class="attachment-preview"><video src="${href}" controls preload="metadata"></video></div>`;
  }

  return `<div class="attachment">
    <div class="attachment-title">Вложение:</div>
    <ul><li><a href="${href}" target="_blank" rel="noopener noreferrer">${name}</a> (${type})</li></ul>
    ${preview}
  </div>`;
}

function messageBody(msg: ExportMessage, useRelativePaths: boolean): string {
  const time = formatExportTime(msg.created_at);
  const role = escapeHtml(msg.author.roleLabel);
  const email = msg.author.email ? escapeHtml(msg.author.email) : null;
  const authorLine = email ? `${role}: ${email}` : role;

  const text = msg.is_deleted
    ? `<p class="deleted">сообщение удалено</p>`
    : `<p class="text">${escapeHtml(msg.content).replace(/\n/g, "<br/>")}</p>`;

  const attachments =
    msg.attachmentsList.length > 0
      ? msg.attachmentsList.map((a) => attachmentHtml(a, useRelativePaths)).join("")
      : "";

  return `<div class="message" id="msg-${escapeHtml(msg.id)}">
    <div class="message-meta"><span class="time">[${time}]</span> <span class="author">${authorLine}</span></div>
    ${replyBlockHtml(msg)}
    ${text}
    ${attachments}
  </div>`;
}

export function buildChatExportHtml(payload: ExportPayload, useRelativePaths = false): string {
  const { meta, messages } = payload;
  const grouped = groupMessagesByDate(messages);

  const headerRows = [
    `<h1>Экспорт чата — ${escapeHtml(meta.storeName)}</h1>`,
    `<p><strong>Chat ID:</strong> ${escapeHtml(meta.chatId)}</p>`,
    meta.clientEmail ? `<p><strong>Клиент:</strong> ${escapeHtml(meta.clientEmail)}</p>` : "",
    meta.staffEmail ? `<p><strong>Оператор/админ:</strong> ${escapeHtml(meta.staffEmail)}</p>` : "",
    `<p><strong>Дата экспорта:</strong> ${escapeHtml(meta.exportDate)}</p>`,
    `<p><strong>Период:</strong> ${escapeHtml(meta.periodLabel)}</p>`,
    `<p><strong>Сообщений:</strong> ${meta.messageCount}</p>`,
    `<p><strong>Вложений:</strong> ${meta.attachmentCount}</p>`,
  ]
    .filter(Boolean)
    .join("\n");

  const body = grouped
    .map(
      (group) => `<section class="day">
    <h2 class="day-title">${escapeHtml(group.date)}</h2>
    ${group.messages.map((m) => messageBody(m, useRelativePaths)).join("\n")}
  </section>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Экспорт чата — ${escapeHtml(meta.storeName)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 860px; margin: 0 auto; padding: 24px; color: #111; background: #fff; line-height: 1.5; }
    h1 { font-size: 1.35rem; margin: 0 0 16px; }
    h2.day-title { font-size: 1rem; color: #666; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; margin: 24px 0 12px; }
    .message { margin: 12px 0; padding: 10px 12px; border-radius: 8px; background: #f7f7f8; }
    .message-meta { font-size: 0.85rem; color: #444; margin-bottom: 6px; }
    .time { color: #888; margin-right: 6px; }
    .author { font-weight: 600; }
    .text { margin: 6px 0 0; white-space: pre-wrap; word-break: break-word; }
    .deleted { margin: 6px 0 0; color: #999; font-style: italic; }
    .reply { margin: 0 0 8px; padding: 8px 10px; border-left: 3px solid #10a37f; background: #eefaf5; font-size: 0.85rem; color: #333; }
    .attachment { margin-top: 8px; font-size: 0.9rem; }
    .attachment-title { font-weight: 600; margin-bottom: 4px; }
    .attachment ul { margin: 0; padding-left: 18px; }
    .attachment-preview img, .attachment-preview video { max-width: 100%; margin-top: 8px; border-radius: 6px; }
    a { color: #10a37f; }
  </style>
</head>
<body>
  <header class="export-header">${headerRows}</header>
  <main>${body || "<p>Нет сообщений за выбранный период.</p>"}</main>
</body>
</html>`;
}

export function buildExportFilename(payload: ExportPayload, ext: "html" | "zip"): string {
  const sitePart = payload.meta.siteSlug === "subs-store" ? "spotify-store" : "gpt-store";
  const emailPart = sanitizeFilenamePart(payload.meta.clientEmail ?? "client");
  const datePart = new Date().toISOString().slice(0, 10);
  return `chat-export-${sitePart}-${emailPart}-${datePart}.${ext}`;
}

export { buildExportPayload };
