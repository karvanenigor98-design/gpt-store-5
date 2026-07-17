/**
 * Quick unit checks for notification preferences / order filter labels.
 * Usage: npx tsx scripts/verify-notification-fixes.ts
 */
import { isEmailRecipientSuppressed } from "../lib/email/suppression";
import { gptOrderStatusLabelRu } from "../lib/admin/gpt-order-status-labels";
import { subsOrderStatusLabelRu } from "../lib/admin/subs-order-status-labels";

const suppressed = [
  "a.havronicheff@yandex.ru",
  "andreihavronicheff@yandex.ru",
  "a49584377@gmail.com",
];

let failed = 0;
for (const email of suppressed) {
  if (!isEmailRecipientSuppressed(email)) {
    console.error("FAIL suppressed", email);
    failed += 1;
  }
}
if (isEmailRecipientSuppressed("ops-test@example.com")) {
  console.error("FAIL unexpectedly suppressed ops-test@example.com");
  failed += 1;
}

if (gptOrderStatusLabelRu("paid") !== "Оплата получена") {
  console.error("FAIL gpt paid label", gptOrderStatusLabelRu("paid"));
  failed += 1;
}
if (subsOrderStatusLabelRu("paid") !== "Оплата получена") {
  console.error("FAIL subs paid label", subsOrderStatusLabelRu("paid"));
  failed += 1;
}

const gptFilter = ["", "awaiting_payment", "paid", "activating", "waiting_client", "active", "failed"];
if (!gptFilter.includes("paid")) {
  console.error("FAIL gpt filter missing paid");
  failed += 1;
}

if (failed) {
  console.error("FAILED", failed);
  process.exit(1);
}
console.log("OK notification + filter checks");
