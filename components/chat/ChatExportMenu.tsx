"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileArchive, FileText, Loader2, MoreVertical, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

type ExportFormat = "html" | "zip" | "attachments";

interface ChatExportMenuProps {
  chatId: string;
  siteSlug?: string;
  isSubsDark?: boolean;
}

function buildExportUrl(params: {
  chatId: string;
  siteSlug: string;
  format: ExportFormat;
  dateFrom: string;
  dateTo: string;
  periodMode: "all" | "range";
}): string {
  const qs = new URLSearchParams({
    chat_id: params.chatId,
    site: params.siteSlug,
    format: params.format,
  });
  if (params.periodMode === "range") {
    if (params.dateFrom) qs.set("date_from", params.dateFrom);
    if (params.dateTo) qs.set("date_to", params.dateTo);
  }
  return `/api/chat/export?${qs.toString()}`;
}

async function triggerDownload(url: string, fallbackName: string): Promise<void> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    let message = "Не удалось сформировать экспорт";
    try {
      const json = (await res.json()) as { error?: string; code?: string };
      if (json.code === "no_files") message = "В этом чате нет файлов";
      else if (json.error) message = json.error;
    } catch {
      if (res.status === 403) message = "Нет доступа к этому чату";
      else if (res.status === 404) message = "В этом чате нет файлов";
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? fallbackName;

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

export function ChatExportMenu({ chatId, siteSlug = "gpt-store", isSubsDark = false }: ChatExportMenuProps) {
  const resolvedSite = siteSlug === "subs-store" ? "subs-store" : "gpt-store";
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState<ExportFormat | null>(null);
  const [periodMode, setPeriodMode] = useState<"all" | "range">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const runExport = useCallback(
    async (format: ExportFormat) => {
      setLoading(format);
      try {
        const url = buildExportUrl({
          chatId,
          siteSlug: resolvedSite,
          format,
          dateFrom,
          dateTo,
          periodMode,
        });
        const ext = format === "html" ? "html" : "zip";
        await triggerDownload(url, `chat-export.${ext}`);
        toast.success(format === "attachments" ? "Файлы скачаны" : "Экспорт чата готов");
        setModalOpen(false);
        setMenuOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Не удалось сформировать экспорт");
      } finally {
        setLoading(null);
      }
    },
    [chatId, resolvedSite, dateFrom, dateTo, periodMode],
  );

  const accent = resolvedSite === "subs-store" ? "#1DB954" : "#10a37f";

  const btnClass = cn(
    "inline-flex items-center justify-center rounded-lg p-2 transition-colors",
    isSubsDark
      ? "text-gray-400 hover:bg-white/10 hover:text-white"
      : "text-gray-500 hover:bg-gray-100 hover:text-gray-800",
  );

  return (
    <>
      <div className="relative flex items-center gap-1" ref={menuRef}>
        <button
          type="button"
          className={cn(btnClass, "hidden sm:inline-flex")}
          title="Экспорт чата"
          aria-label="Экспорт чата"
          onClick={() => setModalOpen(true)}
        >
          <FileText className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={cn(btnClass, "hidden sm:inline-flex")}
          title="Скачать все файлы"
          aria-label="Скачать все файлы"
          disabled={loading === "attachments"}
          onClick={() => void runExport("attachments")}
        >
          {loading === "attachments" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </button>

        <button
          type="button"
          className={cn(btnClass, "sm:hidden")}
          aria-label="Действия чата"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div
            className={cn(
              "absolute right-0 top-full z-30 mt-1 min-w-[200px] rounded-lg border py-1 shadow-lg",
              isSubsDark ? "border-white/10 bg-[#1a1a1a]" : "border-gray-200 bg-white",
            )}
          >
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                isSubsDark ? "text-gray-200 hover:bg-white/5" : "text-gray-700 hover:bg-gray-50",
              )}
              onClick={() => {
                setMenuOpen(false);
                setModalOpen(true);
              }}
            >
              <FileText className="h-4 w-4" /> Экспорт чата
            </button>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                isSubsDark ? "text-gray-200 hover:bg-white/5" : "text-gray-700 hover:bg-gray-50",
              )}
              disabled={loading === "attachments"}
              onClick={() => void runExport("attachments")}
            >
              {loading === "attachments" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Скачать все файлы
            </button>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            className={cn(
              "w-full max-w-md rounded-xl border p-4 shadow-xl",
              isSubsDark ? "border-white/10 bg-[#161616] text-white" : "border-gray-200 bg-white text-gray-900",
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-export-title"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="chat-export-title" className="text-base font-semibold">
                Экспорт чата
              </h2>
              <button type="button" className={btnClass} aria-label="Закрыть" onClick={() => setModalOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="period"
                  checked={periodMode === "all"}
                  onChange={() => setPeriodMode("all")}
                />
                Весь чат
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="period"
                  checked={periodMode === "range"}
                  onChange={() => setPeriodMode("range")}
                />
                За период
              </label>

              {periodMode === "range" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="mb-1 block text-xs text-gray-500">Дата от</span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className={cn(
                        "w-full rounded-lg border px-2 py-1.5 text-sm",
                        isSubsDark ? "border-white/10 bg-[#0d0d0d]" : "border-gray-200",
                      )}
                    />
                  </div>
                  <div>
                    <span className="mb-1 block text-xs text-gray-500">Дата до</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className={cn(
                        "w-full rounded-lg border px-2 py-1.5 text-sm",
                        isSubsDark ? "border-white/10 bg-[#0d0d0d]" : "border-gray-200",
                      )}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void runExport("html")}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                style={{ backgroundColor: accent }}
              >
                {loading === "html" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Скачать HTML
              </button>
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void runExport("zip")}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-60",
                  isSubsDark ? "border-white/15 hover:bg-white/5" : "border-gray-200 hover:bg-gray-50",
                )}
              >
                {loading === "zip" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
                ZIP с файлами
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
