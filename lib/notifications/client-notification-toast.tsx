"use client";

import { toast } from "sonner";

const shown = new Set<string>();

export function showClientNotificationToast(params: {
  id: string;
  title: string;
  message: string;
  href: string;
  accent: string;
}): void {
  if (shown.has(params.id)) return;
  shown.add(params.id);

  toast.custom(
    (t) => (
      <div className="pointer-events-auto w-[min(100vw-2rem,340px)] rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">{params.title}</p>
          <button
            type="button"
            className="shrink-0 text-gray-400 hover:text-gray-600"
            aria-label="Закрыть"
            onClick={() => toast.dismiss(t)}
          >
            ×
          </button>
        </div>
        {params.message ? (
          <p className="mt-1 line-clamp-2 text-xs text-gray-600">{params.message}</p>
        ) : null}
        <a
          href={params.href}
          className="mt-3 inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ backgroundColor: params.accent }}
          onClick={() => toast.dismiss(t)}
        >
          Открыть
        </a>
      </div>
    ),
    { duration: 5000, position: "top-right" },
  );
}
