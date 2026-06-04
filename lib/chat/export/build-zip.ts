import JSZip from "jszip";

import { collectAllAttachments } from "./attachments";
import { buildChatExportHtml, buildExportFilename } from "./build-html";
import type { ExportPayload } from "./types";

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 100;
const FETCH_TIMEOUT_MS = 15000;

async function fetchAttachmentBuffer(url: string): Promise<ArrayBuffer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return buf.byteLength <= 8 * 1024 * 1024 ? buf : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function buildChatExportZip(payload: ExportPayload): Promise<{ buffer: Buffer; filename: string }> {
  const zip = new JSZip();
  const html = buildChatExportHtml(payload, true);
  zip.file("chat.html", html);

  const attachments = collectAllAttachments(payload.messages).slice(0, MAX_ATTACHMENT_COUNT);
  let totalBytes = 0;

  for (const att of attachments) {
    if (!att.zipPath) continue;
    const buf = await fetchAttachmentBuffer(att.url);
    if (!buf) continue;
    totalBytes += buf.byteLength;
    if (totalBytes > MAX_ATTACHMENT_BYTES) break;
    zip.file(att.zipPath, buf);
  }

  const arrayBuffer = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
  return {
    buffer: Buffer.from(arrayBuffer),
    filename: buildExportFilename(payload, "zip"),
  };
}

export async function buildAttachmentsOnlyZip(payload: ExportPayload): Promise<{ buffer: Buffer; filename: string } | null> {
  const attachments = collectAllAttachments(payload.messages);
  if (attachments.length === 0) return null;

  const zip = new JSZip();
  let totalBytes = 0;
  let added = 0;

  for (const att of attachments.slice(0, MAX_ATTACHMENT_COUNT)) {
    if (!att.zipPath) continue;
    const buf = await fetchAttachmentBuffer(att.url);
    if (!buf) continue;
    totalBytes += buf.byteLength;
    if (totalBytes > MAX_ATTACHMENT_BYTES) break;
    zip.file(att.zipPath, buf);
    added += 1;
  }

  if (added === 0) return null;

  const arrayBuffer = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
  const base = buildExportFilename(payload, "zip").replace(/\.zip$/, "");
  return {
    buffer: Buffer.from(arrayBuffer),
    filename: `${base}-files.zip`,
  };
}
