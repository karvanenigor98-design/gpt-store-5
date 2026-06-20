import { MAX_CHAT_MESSAGE_LENGTH, validateMessageText } from "@/lib/chat/message-validation";

/**
 * Семантика типов `chat_sessions.type` в БД:
 * - `operator` — CLIENT_SUPPORT: клиент ↔ поддержка (оператор/админ);
 * - `staff` — ADMIN_OPERATOR: внутренняя переписка admin ↔ operator;
 * - `ai` — сценарии с ботом в одной support-нити.
 */
export const CHAT_TYPE_CLIENT_SUPPORT = "operator" as const;
export const CHAT_TYPE_ADMIN_OPERATOR = "staff" as const;

export const MAX_MESSAGE_LENGTH = MAX_CHAT_MESSAGE_LENGTH;

export function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function validateMessage(text: string): string | null {
  return validateMessageText(text);
}

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
]);

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) return "Файл больше 8 МБ";
  if (!ALLOWED_MIME.has(file.type) && !file.name.match(/\.(pdf|txt|doc|docx)$/i)) {
    return "Недопустимый тип файла";
  }
  return null;
}

export function isImageType(mime: string): boolean {
  return mime.startsWith("image/");
}

/** Экранирует HTML и переносы оставляем для replace в bubble */
export function sanitizeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
