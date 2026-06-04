import type { ChatMessage } from "@/types";
import type { ExportAttachment } from "./types";
import { safeZipEntryName } from "./escape";

function folderForMime(mime: string): "photos" | "videos" | "documents" | "files" {
  if (mime.startsWith("image/")) return "photos";
  if (mime.startsWith("video/")) return "videos";
  if (
    mime.startsWith("application/pdf") ||
    mime.includes("document") ||
    mime.includes("word") ||
    mime.includes("sheet") ||
    mime.startsWith("text/")
  ) {
    return "documents";
  }
  return "files";
}

function extFromName(name: string, mime: string): string {
  const fromName = name.includes(".") ? name.split(".").pop() : null;
  if (fromName && fromName.length <= 8) return fromName;
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "application/pdf") return "pdf";
  return "bin";
}

export function parseMessageAttachments(message: ChatMessage): ExportAttachment[] {
  const raw = message.attachments;
  if (!raw) return [];

  const items: Array<{ url?: string; type?: string; name?: string }> = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (entry && typeof entry === "object") items.push(entry as typeof items[number]);
    }
  } else if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.url === "string") {
      items.push({ url: obj.url, type: typeof obj.type === "string" ? obj.type : undefined, name: typeof obj.name === "string" ? obj.name : undefined });
    }
  }

  return items
    .filter((a) => typeof a.url === "string" && a.url.trim())
    .map((a, idx) => {
      const url = a.url!.trim();
      const type = a.type?.trim() || "application/octet-stream";
      const name = a.name?.trim() || `attachment-${idx + 1}.${extFromName("", type)}`;
      const folder = folderForMime(type);
      const safeName = safeZipEntryName(name, `file-${idx + 1}.${extFromName(name, type)}`);
      return {
        url,
        type,
        name,
        messageId: message.id,
        zipPath: `${folder}/${message.id.slice(0, 8)}-${safeName}`,
      };
    });
}

export function collectAllAttachments(messages: ChatMessage[]): ExportAttachment[] {
  const out: ExportAttachment[] = [];
  for (const msg of messages) {
    if (msg.is_deleted) continue;
    out.push(...parseMessageAttachments(msg));
  }
  return out;
}
