"use client";

import { toast } from "sonner";

import {
  persistAdminSiteBeforeNavigate,
  siteSlugFromAlertSiteId,
  type StaffPanelRoot,
} from "@/lib/admin/notificationNavigation";

export type StaffToastPayload = {
  id: string;
  title: string;
  body: string;
  href: string;
  type?: string | null;
  site_id?: string | null;
};

const shownIds = new Set<string>();
const repeatLastAt = new Map<string, number>();

const REPEAT_TYPES = new Set(["new_order", "new_chat_message"]);
const REPEAT_COOLDOWN_MS = 90_000;
const TOAST_DURATION_MS = 5_000;

function staffHref(href: string, staffRoot: StaffPanelRoot): string {
  if (staffRoot === "/operator" && href.startsWith("/admin")) {
    return href.replace(/^\/admin/, "/operator");
  }
  return href;
}

function toastDedupeKey(item: StaffToastPayload): string {
  const site = item.site_id ?? "gpt-store";
  return `${site}:${item.id}`;
}

function repeatKey(item: StaffToastPayload): string {
  return `${item.type ?? "generic"}:${toastDedupeKey(item)}`;
}

export function shouldShowStaffToast(item: StaffToastPayload): boolean {
  const key = toastDedupeKey(item);
  if (shownIds.has(key)) {
    if (!item.type || !REPEAT_TYPES.has(item.type)) return false;
    const last = repeatLastAt.get(repeatKey(item)) ?? 0;
    if (Date.now() - last < REPEAT_COOLDOWN_MS) return false;
  }
  return true;
}

export function markStaffToastShown(item: StaffToastPayload): void {
  shownIds.add(toastDedupeKey(item));
  if (item.type && REPEAT_TYPES.has(item.type)) {
    repeatLastAt.set(repeatKey(item), Date.now());
  }
}

export function showStaffNotificationToast(
  item: StaffToastPayload,
  staffRoot: StaffPanelRoot,
): void {
  if (!shouldShowStaffToast(item)) return;
  markStaffToastShown(item);

  const link = staffHref(item.href, staffRoot);
  const cta =
    item.type === "new_chat_message"
      ? "Перейти в чат"
      : item.type === "new_order" || item.type === "payment_success"
        ? "Открыть заказ"
        : item.type === "new_review"
          ? "Открыть отзывы"
          : "Открыть";

  toast.custom(
    (t) => (
      <div
        className="pointer-events-auto w-[min(100vw-2rem,360px)] rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
        role="status"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">{item.title}</p>
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Закрыть"
            onClick={() => toast.dismiss(t)}
          >
            ×
          </button>
        </div>
        <p className="mt-1 line-clamp-3 text-xs text-gray-600">{item.body}</p>
        <a
          href={link}
          className="mt-3 inline-flex rounded-lg bg-[#10a37f] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          onClick={() => {
            persistAdminSiteBeforeNavigate(siteSlugFromAlertSiteId(item.site_id));
            toast.dismiss(t);
          }}
        >
          {cta}
        </a>
      </div>
    ),
    { duration: TOAST_DURATION_MS, position: "top-right" },
  );
}
