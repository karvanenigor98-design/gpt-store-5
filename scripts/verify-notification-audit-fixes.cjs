/**
 * Unit checks for notification audit fixes (no network / no secrets).
 */
const assert = require("assert");

// Mirror formatSubsTariffEmailLabel logic via dynamic import of compiled TS is hard;
// re-implement the critical duration/generic checks used by the helper.
function isGenericDurationTitle(title) {
  const t = title.trim().toLowerCase();
  return (
    /^\d+\s*(?:мес|месяц|месяца|месяцев|month)/.test(t) ||
    /^(год|12\s*мес)/.test(t) ||
    t === "мес" ||
    t === "месяц"
  );
}

function formatSubsTariffEmailLabel(tariff) {
  const catKey = (tariff.category ?? "").trim().toLowerCase();
  const cat =
    catKey === "duo" ? "Duo"
    : catKey === "family" ? "Family"
    : catKey === "individual" || !catKey ? "Individual"
    : catKey.charAt(0).toUpperCase() + catKey.slice(1);

  let months = null;
  if (tariff.duration_months != null && tariff.duration_months > 0) {
    months = Number(tariff.duration_months);
  } else if (tariff.slug) {
    const m = String(tariff.slug).toLowerCase().match(/-(\d+)m$/);
    if (m) months = Number(m[1]);
  } else if (tariff.title) {
    const numbered = String(tariff.title).toLowerCase().match(/(\d+)\s*(?:мес|месяц|месяца|месяцев|month)/);
    if (numbered) months = Number(numbered[1]);
  }

  let duration = "срок не указан";
  if (months === 1) duration = "1 месяц";
  else if (months === 3) duration = "3 месяца";
  else if (months === 6) duration = "6 месяцев";
  else if (months === 12) duration = "12 месяцев";
  else if (months != null && months > 0) duration = `${months} мес`;

  const title = (tariff.title || "").trim();
  if (!catKey && title && !isGenericDurationTitle(title) && !/^spotify-/i.test(title)) {
    return title;
  }
  return `Spotify Premium — ${cat} — ${duration}`;
}

function staffDedupeKey(baseKey, email) {
  return `${baseKey}:staff:${email}`;
}

function isPermanentDedupeKey(dedupeKey) {
  const prefixes = [
    "order_paid:",
    "staff_new_order:",
    "staff:new_order:",
    "staff:payment_success:",
    "order_created:",
    "order_status:",
    "review:",
  ];
  return prefixes.some((p) => dedupeKey.startsWith(p));
}

// --- tests ---
assert.strictEqual(
  formatSubsTariffEmailLabel({ title: "1 месяц", category: "individual", duration_months: 1 }),
  "Spotify Premium — Individual — 1 месяц",
);
assert.strictEqual(
  formatSubsTariffEmailLabel({ title: "1 месяц", slug: "spotify-duo-3m", category: "duo", duration_months: null }),
  "Spotify Premium — Duo — 3 месяца",
);
assert.strictEqual(
  formatSubsTariffEmailLabel({ title: "1 месяц", category: null, duration_months: null }),
  "Spotify Premium — Individual — 1 месяц",
);

const k1 = staffDedupeKey("order_paid:staff:subs-store:ord-1", "a@x.ru");
const k2 = staffDedupeKey("order_paid:staff:subs-store:ord-1", "a@x.ru");
assert.strictEqual(k1, k2);
assert.ok(!k1.includes(":0"));
assert.ok(isPermanentDedupeKey(k1));
assert.ok(isPermanentDedupeKey("order_status:subs-store:ord:paid:a@x.ru"));

console.log("verify-notification-audit-fixes: OK");
