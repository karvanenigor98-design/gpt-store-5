import { cn } from "@/lib/utils";

/** Стили карточки уведомления: непрочитанные заметно выделяются. */
export function notificationCardClass(isRead: boolean, site: "gpt-store" | "subs-store" = "gpt-store") {
  const borderAccent = site === "subs-store" ? "border-l-[#1DB954]" : "border-l-[#10a37f]";
  const bgUnread = site === "subs-store" ? "bg-[#1DB954]/8" : "bg-[#10a37f]/8";
  const ringUnread = site === "subs-store" ? "ring-[#1DB954]/25" : "ring-[#10a37f]/25";

  return cn(
    "group relative flex items-start gap-3 rounded-xl border p-4 transition-all cursor-pointer",
    isRead ?
      "border-gray-200 bg-gray-50/90 opacity-[0.72] hover:bg-gray-100/90"
    : [
        "border-gray-200 shadow-md",
        borderAccent,
        "border-l-4",
        bgUnread,
        `ring-2 ${ringUnread}`,
        "hover:shadow-lg",
      ],
  );
}

export function notificationTitleClass(isRead: boolean) {
  return cn(
    "text-sm font-semibold",
    isRead ? "font-normal text-gray-500 line-through decoration-gray-300/80" : "text-gray-900",
  );
}

export function notificationUnreadBadge(site: "gpt-store" | "subs-store" = "gpt-store") {
  const bg = site === "subs-store" ? "bg-[#1DB954]" : "bg-[#10a37f]";
  return cn(
    "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white",
    bg,
  );
}
