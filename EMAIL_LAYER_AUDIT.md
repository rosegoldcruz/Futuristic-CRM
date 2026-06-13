# Email Layer Audit

The old `/email-engine` area is a functional navigation shell with placeholder module pages. It has routes for contacts, companies, lists, templates, campaigns, queue, exports, deliverability, compliance, and settings, but does not implement working CRUD or send workflows.

The repo uses Prisma/Postgres, Next.js App Router, NextAuth session guards, and `DashboardShell` for the authenticated UI. The safest build path is to leave `/email-engine` untouched and add the production operational layer under `/mail`.

Dead shell:

- `/email-engine/contacts`
- `/email-engine/companies`
- `/email-engine/lists`
- `/email-engine/templates`
- `/email-engine/campaigns`
- `/email-engine/queue`
- `/email-engine/settings`

Database layer:

- Prisma schema in `prisma/schema.prisma`
- Shared client in `lib/prisma.ts`
- New migration in `prisma/migrations/20260613000100_email_send_layer/migration.sql`

Implementation path:

- Create mapped `email_*` Prisma models and SQL tables.
- Add server actions in `lib/mail/actions.ts`.
- Add rendering and SMTP helpers in `lib/mail`.
- Add authenticated `/mail/*` pages inside the existing app shell.

Risks/blockers:

- Actual delivery is unavailable until SMTP env vars or local sendmail exist.
- Sending is intentionally disabled by default in `email_send_settings`.
- Mass sending should wait for DNS/authentication, bounce processing, and warmup.
