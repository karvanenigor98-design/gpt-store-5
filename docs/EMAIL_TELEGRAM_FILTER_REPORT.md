# Email / Telegram / Order Filter — Technical Report

Date: 2026-07-17  
Scope: GPT STORE + Spotify STORE (shared Next.js, shared primary Supabase `cgamktdrqkxnnmnruvvq`)

---

## 1. Why emails stopped

System emails were **queued into `notification_outbox` but not delivered**.

Evidence (production DB before drain):

| channel | status | count |
|---------|--------|------:|
| email | pending | ~200 |
| telegram | pending | ~55 |
| email | sent | 1 |

Almost all pending rows had `attempts = 0` → worker never claimed them for ~24h+.

API/events still worked: `email_notification_logs` kept inserting `pending` / `skipped`, so the business path thought mail was “accepted”.

## 2. Root cause

**Primary:** delivery path became **outbox-only** after migration `022_notification_outbox`. Cron `GET /api/cron/notification-outbox` (`*/2`) did not effectively drain the queue (auth/plan/timeout budget). Manual cron with `CRON_SECRET` worked; Vercel scheduled runs did not clear backlog.

**Secondary (when worker does run):**

- Resend: `mail.ru` sender domain **not verified** → HTTP 403
- SMTP failover works for most recipients
- Some recipients hard-fail (terminated mailbox, e.g. `nbuzanov@mail.ru`)
- Telegram from local network often **times out** (api.telegram.org unreachable); Vercel can reach it, but bad payloads previously returned HTTP 400

## 3. Email provider

**Stack:** Resend → SMTP failover (Nodemailer), controlled by `EMAIL_PROVIDER` / auto order in `lib/email/send-email.ts`.

Production Vercel (`gpt-store-5`):

| ENV | Present |
|-----|---------|
| EMAIL_NOTIFICATIONS_ENABLED | yes |
| EMAIL_PROVIDER | **missing** (auto → Resend first) |
| RESEND_API_KEY | yes |
| RESEND_FROM_EMAIL | yes |
| SMTP_HOST / SMTP_USER / SMTP_PASSWORD / SMTP_FROM_EMAIL | yes |
| CRON_SECRET | yes |
| TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID | yes |
| ADMIN_EMAIL / OPERATOR_EMAIL | yes |
| EMAIL_NOTIFICATION_BLOCKLIST | missing (OK; required list in code) |

Auth emails are separate (`purpose: "auth"`) and bypass notification suppression / global off switch.

## 4. Recipients

Staff: `collectStaffRecipientsForSite(siteSlug)` — profiles admin/operator + site_memberships + `user_site_access` + `ADMIN_EMAIL(S)` / `OPERATOR_EMAIL(S)`.

Customer: order/account email resolvers in notify hooks.

## 5. Three-address exclusion

Centralized in `lib/email/suppression.ts`:

- `a.havronicheff@yandex.ru`
- `andreihavronicheff@yandex.ru`
- `a49584377@gmail.com`
- plus optional `EMAIL_NOTIFICATION_BLOCKLIST`

Applies only to **system** emails. Auth / in-app / Telegram unchanged.

## 6. Code fixes applied

| File | Change |
|------|--------|
| `lib/notifications/outbox.ts` | `kickNotificationOutbox()` after enqueue — delivery no longer depends only on Vercel cron |
| `app/api/cron/notification-outbox/route.ts` | multi-wave drain (4×25), POST+GET, structured logs |
| `lib/notifications/outbox-worker.ts` | email-first sort, safer TG error logging, deliver logs |
| `lib/notifications/client-chat-alert.ts` | Telegram **before** email throttle return |
| `lib/telegram/notifications.ts` | multi chat IDs; richer new-order message; broadcast helper |
| `lib/email/suppression.ts` | docs + diagnostic counter helper |
| `app/(admin)/admin/orders/page.tsx` | GPT filter chip `paid` / «Оплата получена» |
| `.env.example` | `TELEGRAM_*_CHAT_IDS` docs |
| `scripts/drain-notification-outbox.cjs` | prod cron drain helper |
| `scripts/run-outbox-worker-local.ts` | local provider drain |
| `scripts/verify-notification-fixes.ts` | suppression + label checks |

## 7. Filter «Оплата получена»

**Cause:** GPT chip array never included `paid` (since unpaid rename to `awaiting_payment`). Status/label/query already supported `paid`. Subs already had the chip. Operator = same admin page.

**Fix:** GPT chips → `["", "awaiting_payment", "paid", "activating", "waiting_client", "active", "failed"]`.

## 8. Telegram

- Remains additional channel (does not replace email)
- Fan-out: `TELEGRAM_ADMIN_CHAT_ID` + optional `TELEGRAM_ADMIN_CHAT_IDS` / `TELEGRAM_OPERATOR_CHAT_ID(S)`
- Chat alerts no longer blocked by email 60s throttle
- New order text includes store, order id, tariff, amount, status, client email, deep link

**Note:** this workstation cannot reach `api.telegram.org` (fetch timeout). Production cron previously returned `telegram_http_400` for some rows — re-test after deploy from Vercel.

## 9. Tests performed

- DB audit of `notification_outbox` / `email_notification_logs`
- Manual prod cron auth OK
- Local worker drain: emails **sending** (95+ sent during session)
- `npx tsx scripts/verify-notification-fixes.ts` → OK
- `tsc --noEmit` → OK
- Suppression unit check for 3 addresses → OK

**Still needs after deploy:** live E2E new order / paid / chat on both stores; confirm Telegram arrives in admin chat; click GPT «Оплата получена» filter in admin+operator UI.

## 10. Remaining risks

1. **Deploy required** — kick/wave cron not live until production redeploy.
2. Prefer `EMAIL_PROVIDER=smtp` on Vercel until Resend domain is verified (avoids wasted Resend 403 latency).
3. Dead/invalid recipient mailboxes will retry until `dead` (expected).
4. Telegram chat_id `-528847007` must be validated in BotFather/getChat after network allows.
5. Hobby cron frequency may still be limited — kick path mitigates this.
6. Do not disable Supabase Auth SMTP when tuning system mail.

## 11. Acceptance status

| Item | Status |
|------|--------|
| Email root cause found | done |
| Email delivery restored (queue drained / kick added) | code done; deploy + remaining queue |
| 3 emails suppressed for system mail only | done |
| Auth emails untouched | done |
| Telegram independent of email throttle | done |
| Multi TG recipients | done |
| Filter «Оплата получена» on GPT | done (Subs already had it) |
| Payment/order business logic unchanged | yes |
