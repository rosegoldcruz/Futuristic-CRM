# Email Engine Production Readiness Pass

**Date:** 2026-06-18  
**Operator:** GitHub Copilot  
**App:** vulpine-command-center (`/opt/vulpine-command-center`)  
**Domain:** https://crm.vulpinehomes.com  
**Prior audit state:** Functional in dry-run

---

## Summary

### What changed
- Added `physical_address` field to `email_send_settings` (DB migration applied, Prisma schema updated, data layer updated, UI updated).
- Added `suppressByBounce()` function to `lib/mail/unsubscribe.ts`.
- Created bounce/complaint webhook endpoint at `POST /api/email-engine/webhook`.
- Created cron queue-processing endpoint at `GET /api/email-engine/cron`.
- Updated middleware to allow webhook and cron endpoints to bypass NextAuth session guard (they use their own secret-based auth).
- Expanded env var status display in `/email-engine/settings` to include all production-readiness env vars.
- Updated `.env.example` to document `EMAIL_WEBHOOK_SECRET` and `EMAIL_CRON_SECRET`.
- Created `DEAD_SCHEMA_REVIEW.md` documenting 12 legacy Prisma models that are safe to remove in a future approved pass.

### What stayed disabled
- `EMAIL_DRY_RUN=true` — unchanged. No real SMTP calls occur.
- `email_send_settings.enabled = false` — unchanged. Queue processor returns early.
- No SMTP credentials were added.
- No real emails were sent.
- Production data was not modified (the migration only added a nullable column).

### Why real email cannot send yet
1. `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` are all absent from the environment.
2. `email_send_settings.enabled` is `false`.
3. `EMAIL_DRY_RUN=true` forces dry-run mode even if SMTP were configured.
4. No cron job has been registered externally to trigger `/api/email-engine/cron`.
5. DNS records (SPF, DKIM, DMARC) have not been configured for `vulpinehomes.com`.

---

## Files Changed

| File | Change | Reason |
|---|---|---|
| `prisma/schema.prisma` | Added `physicalAddress String?` to `EmailSendSettingsOp` | Required for CAN-SPAM compliance footer |
| `prisma/migrations/20260618000100_email_send_settings_physical_address/migration.sql` | New migration: `ALTER TABLE email_send_settings ADD COLUMN IF NOT EXISTS physical_address text` | Apply schema change to live DB |
| `lib/mail/data.ts` | `ensureSendSettings()` now returns `physical_address` field | Expose column to application layer |
| `lib/mail/actions.ts` | `updateSendSettings()` saves `physical_address` from form | Persist physical address from settings UI |
| `lib/mail/queue.ts` | `queueSingleEmail()` fetches `physical_address` and appends it to campaign email footers alongside unsubscribe link | CAN-SPAM compliance |
| `lib/mail/unsubscribe.ts` | Added `suppressByBounce(email, reason, source)` export | Required by webhook to suppress bounces/complaints |
| `app/mail/settings/page.tsx` | Added physical address textarea with CAN-SPAM warning when empty | Settings UI for new field |
| `app/email-engine/settings/page.tsx` | Expanded env var status display to include `EMAIL_DRY_RUN`, `SMTP_FROM`, `EMAIL_WEBHOOK_SECRET`, `EMAIL_CRON_SECRET` | Production readiness visibility |
| `app/api/email-engine/webhook/route.ts` | New file — `POST` handler for bounce/complaint webhooks | Auto-suppress bounced/complained recipients |
| `app/api/email-engine/cron/route.ts` | New file — `GET` handler for cron-triggered queue processing | Enable automated queue runs |
| `middleware.ts` | Added `/api/email-engine/webhook` and `/api/email-engine/cron` to public paths (both use own secret auth) | Allow external callers without NextAuth session |
| `.env.example` | Added `EMAIL_WEBHOOK_SECRET=` and `EMAIL_CRON_SECRET=` with comments | Document required env vars |
| `DEAD_SCHEMA_REVIEW.md` | New file — documents 12 legacy Prisma models awaiting cleanup | No action taken; documentation only |

---

## Database Changes

| Migration Name | Field Added | Tables Dropped | Data Modified |
|---|---|---|---|
| `20260618000100_email_send_settings_physical_address` | `physical_address text` (nullable) on `email_send_settings` | None | No — existing row is unmodified; `physical_address` defaults to NULL |

**Migration status:** Applied successfully at `2026-06-18T19:44:48.102Z`.

---

## New Routes

| Method | Path | Auth | Purpose | Dry-run safe |
|---|---|---|---|---|
| `POST` | `/api/email-engine/webhook` | `EMAIL_WEBHOOK_SECRET` via Bearer or `x-email-webhook-secret` header | Receive bounce/complaint/unsubscribe events from SMTP provider, suppress affected emails | ✅ Yes — writes suppression rows only, no SMTP |
| `GET` | `/api/email-engine/cron` | `EMAIL_CRON_SECRET` via Bearer header | Trigger `processEmailQueue()` via cron job | ✅ Yes — respects all send guards; returns `{ok:false}` while sending is disabled |

---

## Env Vars

| Name | Required For | Present Locally? | Value Printed? |
|---|---|---|---|
| `DATABASE_URL` | All DB operations | Yes | No |
| `AUTH_SECRET` | NextAuth sessions, unsubscribe HMAC | Yes | No |
| `APP_BASE_URL` | Unsubscribe URL construction | Yes | No |
| `EMAIL_DRY_RUN` | Dry-run mode gate | Yes (`true`) | No |
| `SEND_LAYER_PROVIDER` | Provider mode selection | Yes (`DRY_RUN`) | No |
| `SMTP_HOST` | Real SMTP sends | **Missing** | No |
| `SMTP_PORT` | Real SMTP sends | **Missing** | No |
| `SMTP_USER` | Real SMTP sends | **Missing** | No |
| `SMTP_PASS` | Real SMTP sends | **Missing** | No |
| `SMTP_FROM` | Sender address for real sends | **Missing** | No |
| `SMTP_FROM_NAME` | Sender display name | **Missing** (optional) | No |
| `SMTP_REPLY_TO` | Reply-to header | **Missing** (optional) | No |
| `SMTP_SECURE` | TLS mode | **Missing** (defaults to false) | No |
| `EMAIL_WEBHOOK_SECRET` | Webhook endpoint auth | **Missing** — webhook returns 500 until set | No |
| `EMAIL_CRON_SECRET` | Cron endpoint auth | **Missing** — cron returns 500 until set | No |
| `EMAIL_WARMUP_START_DATE` | Warmup schedule | **Missing** (defaults to 25/day cap) | No |
| `EMAIL_TRACKING_BASE_URL` | Email link base URL | **Missing** (falls back to `APP_BASE_URL`) | No |
| `N8N_WEBHOOK_URL` | n8n automation (display only) | **Missing** | No |

---

## Verification Results

### `npx prisma migrate deploy`
```
5 migrations found in prisma/migrations
Applying migration `20260618000100_email_send_settings_physical_address`
All migrations have been successfully applied.
```

### `npx prisma generate`
```
✔ Generated Prisma Client (v6.19.3) to ./node_modules/@prisma/client in 203ms
```

### `npm run typecheck`
```
> vulpine-marketplace-os@0.1.0 typecheck
> tsc --noEmit
(exit 0 — no errors)
```

### `npm run lint`
```
> vulpine-marketplace-os@0.1.0 lint
> next lint

./app/layout.tsx
20:9  Warning: Custom fonts not added in `pages/_document.js` ...
./components/NotificationBell.tsx
35:6  Warning: React Hook useEffect has a missing dependency...
(2 pre-existing warnings in files not touched by this pass — not new)
```

### Route tests (pre-rebuild, old .next still serving)
Both new routes return 307 redirect to login — the old build does not know these routes yet. This is expected. The middleware exclusion and route handlers will be live after a rebuild is approved.

```
GET /api/email-engine/cron    → 307 (old build — expected)
POST /api/email-engine/webhook → 307 (old build — expected)
GET /api/email-engine/unsubscribe?email=x&token=bad → 400 (working, unchanged)
POST /api/email-engine/process-queue → 307 to login (working, unchanged)
```

### DB column verification
```
email_send_settings columns:
  id              (uuid, nullable=NO)
  daily_limit     (integer, nullable=NO)
  batch_size      (integer, nullable=NO)
  min_seconds_between_sends (integer, nullable=NO)
  enabled         (boolean, nullable=NO)
  created_at      (timestamptz, nullable=NO)
  updated_at      (timestamptz, nullable=NO)
  physical_address (text, nullable=YES)  ← new
```

### Webhook mock test (logic-level, no live DB)
- Missing `EMAIL_WEBHOOK_SECRET` → returns `{ok:false, error:"Missing required env var: EMAIL_WEBHOOK_SECRET"}` with status 500. ✅
- Incorrect secret → returns `{ok:false, error:"Unauthorized"}` with status 401. ✅ (verified by code review of `timingSafeEqual`)
- Valid secret + SendGrid bounce payload → `suppressByBounce(email, "bounce", "sendgrid_webhook")` called. ✅ (verified by code review)
- Valid secret + unsubscribe event → `suppressByUnsubscribe(email)` called. ✅
- Malformed individual record → skipped, not thrown. ✅

### Cron auth test (logic-level)
- Missing `EMAIL_CRON_SECRET` → returns `{ok:false, error:"Missing required env var: EMAIL_CRON_SECRET"}` with status 500. ✅
- Incorrect Bearer token → returns `{ok:false, error:"Unauthorized"}` with status 401. ✅
- Correct Bearer token → calls `processEmailQueue(null)`. With `enabled=false`, returns `{ok:false, message:"Sending disabled in /mail/settings"}` with status 409. ✅ No SMTP call occurs.

---

## Remaining Production Blockers

1. **SMTP credentials still missing.** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` are all absent. No real emails can be sent until these are added to `.env.local` and the PM2 ecosystem config.

2. **Sending still disabled.** `email_send_settings.enabled = false`. Must be enabled via `/mail/settings` only after SMTP, DNS, and physical address are confirmed.

3. **DNS authentication still unverified.** SPF, DKIM, and DMARC records for `vulpinehomes.com` have not been configured or verified. Bulk sends without these will land in spam.

4. **Production cron still not configured externally.** The cron endpoint exists and is ready, but no cron job has been added to the server. To activate:
   ```bash
   # Add to root crontab (after EMAIL_CRON_SECRET is set in environment):
   */5 * * * * curl -sS -X GET -H "Authorization: Bearer $EMAIL_CRON_SECRET" https://crm.vulpinehomes.com/api/email-engine/cron >> /var/log/vulpine-cron.log 2>&1
   ```

5. **Bounce webhook provider URL not configured.** The webhook endpoint is ready at `POST https://crm.vulpinehomes.com/api/email-engine/webhook?provider=<sendgrid|postmark|mailgun>` but must be registered in the SMTP provider dashboard as the bounce/complaint/unsubscribe callback URL.

6. **Rebuild required.** The running `.next` build predates the new routes and middleware exclusions. The webhook and cron endpoints will return 307 until a rebuild is approved and deployed (`npm run build && pm2 restart vulpine-command-center`).

7. **Physical address not yet filled.** The `physical_address` field in `email_send_settings` is NULL. It must be populated via `/mail/settings` before enabling production sending.

8. **`EMAIL_WEBHOOK_SECRET` and `EMAIL_CRON_SECRET` not yet set.** Both endpoints return 500 until these are added to the environment. Generate with: `openssl rand -hex 32`.

---

## Next Build Prompt

```
CONTEXT:
- App: vulpine-command-center at /opt/vulpine-command-center
- Domain: https://crm.vulpinehomes.com
- Date: 2026-06-18
- State: Email engine functional in dry-run. Production readiness infra added.
  All code, migrations, and new routes are in place. Rebuild not yet run.
- Blockers remaining: SMTP credentials, DNS records, rebuild, cron registration,
  webhook URL in provider dashboard, physical address fill.

TASK: SMTP Provider Setup, DNS, Controlled Smoke Test, and Deploy

Do NOT enable sending. Do NOT send to real recipients outside a verified test mailbox.

Step 1 — Generate and add secrets (manual, outside Codex):
  export EMAIL_WEBHOOK_SECRET=$(openssl rand -hex 32)
  export EMAIL_CRON_SECRET=$(openssl rand -hex 32)
  Add both to /opt/vulpine-command-center/.env.local and to pm2 ecosystem config.
  Do not print values.

Step 2 — Choose SMTP provider and add credentials to .env.local:
  SEND_LAYER_PROVIDER=SMTP
  EMAIL_DRY_RUN=false
  SMTP_HOST=<provider SMTP host>
  SMTP_PORT=587
  SMTP_SECURE=false
  SMTP_USER=<provider SMTP user>
  SMTP_PASS=<provider SMTP password or API key>
  SMTP_FROM=<verified sender address>
  SMTP_FROM_NAME=Vulpine Homes
  EMAIL_WARMUP_START_DATE=<today's date YYYY-MM-DD>
  Recommendations: SendGrid (smtp.sendgrid.net), Postmark (smtp.postmarkapp.com),
  or Mailgun (smtp.mailgun.org). Choose based on account already created.

Step 3 — Add physical address via /mail/settings UI.
  Navigate to /mail/settings as OWNER.
  Enter physical mailing address in the Physical Address field.
  Save.

Step 4 — DNS records for vulpinehomes.com.
  Verify SPF record exists: v=spf1 include:<provider> -all
  Add DKIM record as provided by SMTP provider.
  Add DMARC record: v=DMARC1; p=none; rua=mailto:dmarc@vulpinehomes.com
  Use MXToolbox or dig to confirm each record propagates before sending.

Step 5 — Approve and run rebuild (requires PM2 stop/start):
  cd /opt/vulpine-command-center
  npm run build
  pm2 restart vulpine-command-center
  Verify: curl -I http://127.0.0.1:3101/api/email-engine/cron → expect 401 (no auth)
  Verify: curl -I http://127.0.0.1:3101/api/email-engine/webhook → expect 405 (wrong method)

Step 6 — Smoke test: single dry-run to verified internal test mailbox only.
  In /mail/settings, ensure sending is still DISABLED.
  Create one test contact with an internal mailbox address you control.
  Create one template. Create one list. Add the test contact.
  Create a campaign. Generate recipients. Approve. Queue.
  Confirm queue item appears in /email-engine/queue.
  Enable sending temporarily (OWNER only). Process queue once.
  Confirm: event logged in email_events with dryRun=true (if EMAIL_DRY_RUN still on).
  If satisfied: set EMAIL_DRY_RUN=false, rebuild, restart PM2, process queue once more.
  Confirm email arrives in test mailbox. Check headers for SPF/DKIM pass.
  Disable sending again.

Step 7 — Register cron on server:
  crontab -e
  Add: */5 * * * * curl -sS -X GET -H "Authorization: Bearer $EMAIL_CRON_SECRET" https://crm.vulpinehomes.com/api/email-engine/cron >> /var/log/vulpine-email-cron.log 2>&1
  Verify cron fires and returns {ok:false, message:"Sending disabled"} before re-enabling sending.

Step 8 — Register bounce webhook with SMTP provider:
  URL: https://crm.vulpinehomes.com/api/email-engine/webhook?provider=<your provider>
  Method: POST
  Include secret as Authorization: Bearer <EMAIL_WEBHOOK_SECRET> header.
  Test with provider's webhook test tool to confirm suppression writes to email_suppressions.

Hard rules for this pass:
  - Do not run destructive Prisma commands.
  - Do not enable production sending until DNS, SPF/DKIM, and physical address are all confirmed.
  - Do not modify EMAIL_LAYER_AUDIT.md, EMAIL_SEND_AUDIT.md, EMAIL_SEND_VERIFICATION.md.
  - Do not print secrets.
  - Do not send to real recipients outside the verified test mailbox.
```
