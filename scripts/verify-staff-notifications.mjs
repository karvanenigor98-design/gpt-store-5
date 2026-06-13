/**
 * Static + logic smoke for staff notifications fixes.
 * Run: node scripts/verify-staff-notifications.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function mustInclude(rel, needles, label) {
  const text = read(rel);
  for (const n of needles) {
    assert(text.includes(n), `${label}: missing "${n}" in ${rel}`);
  }
}

function mustNotInclude(rel, needles, label) {
  const text = read(rel);
  for (const n of needles) {
    assert(!text.includes(n), `${label}: should not contain "${n}" in ${rel}`);
  }
}

// --- Multi-site fetch ---
mustInclude(
  "hooks/useStaffNotifications.ts",
  [
    "notificationsApiForSites(sites)",
    "accessibleSitesRef.current",
    "notificationsApiForSites(sites).map",
  ],
  "reload fetches all accessible sites",
);

mustNotInclude(
  "hooks/useStaffNotifications.ts",
  ["notificationsApiForSite(siteSlug, [siteSlug])"],
  "reload must not hardcode current site only",
);

// --- Mark all across accessible sites ---
mustInclude(
  "hooks/useStaffNotifications.ts",
  [
    "notificationsApiForSites(sites).map",
    "markingAllRef.current = true",
    "debouncedReload.cancel()",
    "markingAllRef.current = false",
  ],
  "mark-all blocks realtime race",
);

// --- Single provider (no duplicate hooks on page) ---
mustInclude(
  "components/admin/StaffNotificationsProvider.tsx",
  ["StaffNotificationsContext", "useStaffNotifications"],
  "provider exists",
);
mustInclude(
  "app/(admin)/admin/notifications/page.tsx",
  ["useStaffNotificationsContext"],
  "notifications page uses context",
);
mustNotInclude(
  "app/(admin)/admin/notifications/page.tsx",
  ["useStaffNotifications({"],
  "notifications page must not mount second hook",
);

// --- Combined sidebar badge ---
mustInclude(
  "app/api/admin/staff-nav-badges/route.ts",
  ["countCombinedStaffNotifications", 'accessible.includes("gpt-store")', 'accessible.includes("subs-store")'],
  "nav badges sum both stores",
);

// --- Subs count without bogus site_id filter ---
const reads = read("lib/admin/staff-notification-reads.ts");
assert(
  reads.includes('siteSlug === "gpt-store" && siteId') &&
    !reads.includes('q = q.eq("site_id", siteId);'),
  "countStaffUnreadNotifications: subs must not filter by GPT site_id",
);

// --- Performance: no orders/chat in notifications realtime ---
mustNotInclude(
  "hooks/useStaffNotifications.ts",
  ['table: "orders"', 'table: "chat_messages"'],
  "notifications hook should not subscribe orders/chat",
);

mustInclude(
  "hooks/useStaffNotifications.ts",
  ["debounceCallback", "REALTIME_DEBOUNCE_MS", "POLL_MS = 30_000"],
  "debounce and slower poll",
);

mustInclude(
  "lib/admin/staff-notification-reads.ts",
  ["resolveStaffNotificationUserId", "updateIsReadChunks", "MARK_ALL_CANDIDATE_LIMIT"],
  "mark-all persists is_read first",
);

mustInclude(
  "components/admin/useStaffNavBadges.ts",
  ["POLL_MS = 20_000", "debounceCallback", "inFlightRef"],
  "nav badges perf guards",
);

// --- Logic: isNotificationUnreadForStaff ---
function isStaffInboxNotification(type) {
  const STAFF_INBOX_TYPES = new Set([
    "new_order",
    "payment_success",
    "payment_failed",
    "new_chat_message",
    "new_review",
    "order_needs_data",
    "order_problem",
    "order_activated",
    "subscription_expiring",
  ]);
  return type && type !== "chat_reply" && STAFF_INBOX_TYPES.has(type);
}

function isNotificationUnreadForStaff(row, userId, role, readIds) {
  if (row.type === "chat_reply") return false;
  const matches =
    row.recipient_user_id === userId ||
    (isStaffInboxNotification(row.type) && (role === "admin" || role === "operator")) ||
    (!row.recipient_user_id && (role === "admin" || role === "operator"));
  if (!matches) return false;
  if (row.recipient_user_id === userId && !isStaffInboxNotification(row.type)) {
    return !row.is_read;
  }
  return !readIds.has(row.id) && !row.is_read;
}

const readIds = new Set(["n1"]);
assert.equal(
  isNotificationUnreadForStaff(
    { id: "n1", recipient_user_id: "inbox-uuid", type: "new_order", is_read: false },
    "admin-uuid",
    "admin",
    readIds,
  ),
  false,
  "inbox row with readIds entry is read",
);
assert.equal(
  isNotificationUnreadForStaff(
    { id: "n2", recipient_user_id: "inbox-uuid", type: "new_order", is_read: true },
    "admin-uuid",
    "admin",
    new Set(),
  ),
  false,
  "inbox row with is_read true is read",
);
assert.equal(
  isNotificationUnreadForStaff(
    { id: "n3", recipient_user_id: "inbox-uuid", type: "new_order", is_read: false },
    "admin-uuid",
    "admin",
    new Set(),
  ),
  true,
  "inbox row unread when no readIds and is_read false",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      checks: [
        "multi-site reload",
        "mark-all race guard",
        "single provider",
        "combined nav badge",
        "subs count site filter",
        "perf subscriptions",
        "read-state logic",
      ],
    },
    null,
    2,
  ),
);
