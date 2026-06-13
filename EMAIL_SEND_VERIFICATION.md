# Email Send Verification

Date: 2026-06-13

## Changed files

- `prisma/schema.prisma`
- `prisma/migrations/20260613000100_email_send_layer/migration.sql`
- `package.json`
- `package-lock.json`
- `lib/mail/actions.ts`
- `lib/mail/data.ts`
- `lib/mail/render-template.ts`
- `lib/mail/smtp.ts`
- `components/mail/*`
- `app/mail/*`
- `components/layout/sidebar.tsx`
- `EMAIL_LAYER_AUDIT.md`
- `EMAIL_SEND_AUDIT.md`
- `EMAIL_SEND_VERIFICATION.md`

## Package changes

- Added `nodemailer`
- Added `@types/nodemailer`

## SMTP/sendmail status

Server audit:

- `postfix`: missing
- `sendmail`: missing
- `postfix.service`: missing
- ports `25`, `465`, `587`: no listener found

Current blocker:

`Missing required mail transport: SMTP env vars or local sendmail`

## Test commands

Completed locally against the production clone:

- `npx prisma generate`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `node -e "console.log('node ok')"`

Completed on the server checkout after patch application:

- `npm install`
- `npm run typecheck`
- `npm run lint`
- `node -p 1`
- `command -v sendmail || true`
- `ss -ltnp | grep -E ':25|:465|:587' || true`

Results:

- Prisma generate: passed
- Typecheck: passed
- Lint: passed with pre-existing warnings outside mail work
- Build: passed in scratch clone; not rerun against live `.next` before deploy approval
- Node check: `node ok`

## Deployment proposal

After review, apply the patch on the server, install packages, run the migration, rebuild, then restart the PM2 app only after approval:

```bash
cd /opt/vulpine-command-center
npm install
npx prisma migrate deploy
npm run build
pm2 restart vulpine-command-center
```

## Rollback plan

Before restart, rollback is:

```bash
cd /opt/vulpine-command-center
git apply -R /tmp/vulpine-mail-layer.patch
npm install
npm run build
```

After migration, rollback requires dropping the new `email_*` tables only if no production data should be kept.

## Send readiness

Single-send and controlled batch-send are implemented, but delivery cannot work on the server yet without SMTP env vars or local sendmail/Postfix. Sending remains disabled by default in `email_send_settings`.
