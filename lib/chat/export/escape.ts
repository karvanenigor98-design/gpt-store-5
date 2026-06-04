import { sanitizeText } from "@/lib/chat/constants";

export function escapeHtml(text: string): string {
  return sanitizeText(text);
}

export function sanitizeFilenamePart(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/@/g, "-at-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (normalized || "export").slice(0, 80);
}

export function safeZipEntryName(name: string, fallback: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, "_").replace(/\.\./g, "_").trim();
  return (base || fallback).slice(0, 200);
}
