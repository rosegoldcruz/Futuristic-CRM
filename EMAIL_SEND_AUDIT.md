# Vulpine Email Send Audit

Date: 2026-06-13

## Current routes

Existing shell routes live under `/email-engine/*` and use `ModulePage` placeholders. New functional routes are built under `/mail/*` so the shell remains intact:

- `/mail`
- `/mail/send`
- `/mail/contacts`
- `/mail/companies`
- `/mail/lists`
- `/mail/templates`
- `/mail/campaigns`
- `/mail/campaigns/[id]`
- `/mail/events`
- `/mail/settings`
- `/mail/suppressions`

## Database approach

The project uses Prisma with PostgreSQL:

- `@prisma/client`
- `prisma/schema.prisma`
- shared lazy client in `lib/prisma.ts`

There were no existing migration files. This build adds a Prisma migration directory and keeps the legacy email-engine models untouched.

## Auth/session approach

Routes use the existing `requireActiveUser()` guard from `lib/auth/access.ts`, backed by NextAuth/Zitadel configuration in `lib/auth/auth.ts`.

## Layout/navigation approach

The app uses `DashboardShell`, `Sidebar`, cyberpunk Tailwind utility classes, and local UI primitives. Mail pages are integrated into the existing app shell and sidebar as `Mail Ops`.

## SMTP/local send status

Verified on `vulpineOS`:

- `postfix`: not found
- `postfix.service`: `Unit postfix.service could not be found.`
- `sendmail`: not found
- listening ports `25`, `465`, `587`: none found

Exact blocker for actual delivery:

`Missing required mail transport: SMTP env vars or local sendmail`

## Safest implementation path

Build the operational layer now, with sending disabled by default:

- Persist contacts, companies, lists, templates, campaigns, recipients, events, suppressions, inbound messages, and send settings in Postgres.
- Use Nodemailer only.
- Prefer explicit SMTP env vars when configured.
- Fall back to local `sendmail` only when the binary exists.
- Require `/mail/settings` to enable sending.
- Enforce suppression checks, contact-status checks, batch size, and daily limits before delivery.

## Risks

- Actual mail delivery is blocked until SMTP env vars are configured or local sendmail/Postfix is installed.
- SPF/DKIM/DMARC, bounce handling, and warmup are not present, so bulk sending should remain off.
- Existing project lint warnings remain outside the mail layer.

## Blockers

- No local mail transport exists on the server.
- `SMTP_FROM` is required before a real send can be attempted.
