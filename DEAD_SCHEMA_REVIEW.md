# Dead Schema Review

**Date:** 2026-06-18  
**Reviewer:** GitHub Copilot (audit-only pass)  
**Purpose:** Determine which legacy Prisma models are safe to remove from `schema.prisma` in a future migration.

---

## Background

The `prisma/schema.prisma` file contains two parallel sets of models:

1. **Legacy models (PascalCase, no `@@map`):** Generated before the `email_*` operational table approach was adopted. These map to tables with Prisma-derived names. All code was migrated to use `$queryRaw` against `email_*` tables directly.

2. **Operational models (`*Op` suffix, with `@@map("email_*")`):** The tables actually queried by all running code. These were added via migrations `20260613000100_email_send_layer` onward.

---

## Model Review Table

| Prisma Model | Inferred DB Table | `@@map` Present | Referenced by Code | DB Table Exists | Rows in DB | Safe to Remove from Schema | Migration Would DROP Table |
|---|---|---|---|---|---|---|---|
| `Company` | `Company` | No | No — no `prisma.company.*` calls found | Yes (Prisma created it) | 0 | **Yes** | Yes — must be guarded with `IF EXISTS` |
| `Contact` | `Contact` | No | No — no `prisma.contact.*` calls found | Yes | 0 | **Yes** | Yes — must be guarded |
| `EmailTemplate` | `EmailTemplate` | No | No — no `prisma.emailTemplate.*` calls found | Yes | 0 | **Yes** | Yes — must be guarded |
| `Campaign` | `Campaign` | No | No — no `prisma.campaign.*` calls found | Yes | 0 | **Yes** | Yes — must be guarded |
| `CampaignQueueItem` | `CampaignQueueItem` | No | No | Yes | 0 | **Yes** | Yes — must be guarded |
| `CampaignEvent` | `CampaignEvent` | No | No | Yes | 0 | **Yes** | Yes — must be guarded |
| `Suppression` | `Suppression` | No | No — no `prisma.suppression.*` calls found | Yes | 0 | **Yes** | Yes — must be guarded |
| `LeadList` | `LeadList` | No | No — no `prisma.leadList.*` calls found | Yes | 0 | **Yes** | Yes — must be guarded |
| `LeadListContact` | `LeadListContact` | No | No | Yes | 0 | **Yes** | Yes — must be guarded |
| `SendLayerExport` | `SendLayerExport` | No | No | Yes | 0 | **Yes** | Yes — must be guarded |
| `ActivityLog` | `ActivityLog` | No | No — `writeAuditEvent` uses `audit_events` table via `AuditEventOp` | Yes | 0 | **Yes** | Yes — must be guarded |
| `Setting` | `Setting` | No | No — settings are stored via `AppSettingOp` → `app_settings` | Yes | 0 | **Yes** | Yes — must be guarded |

---

## Dependent Legacy Enums

These enums are only referenced by the legacy models above and would also be safe to remove once the models are removed:

| Enum | Used By | Safe to Remove With Models |
|---|---|---|
| `ContactStatus` | `Contact` | Yes |
| `TemplateStatus` | `EmailTemplate` | Yes |
| `CampaignStatus` | `Campaign` | Yes |
| `QueueStatus` | `CampaignQueueItem` | Yes |
| `SuppressionReason` | `Suppression` | Yes |
| `SendLayer` | `Campaign`, `SendLayerExport` | Yes |
| `SendLayerSyncStatus` | `SendLayerExport` | Yes |
| `AutomationStatus` | `AutomationEvent`, `AutomationWorkflow` | **No** — `AutomationEvent` and `AutomationWorkflow` are live models |
| `AutomationDirection` | `AutomationWorkflow` | **No** — live model |
| `ValueType` | `Setting` | Yes (if `Setting` is removed) |

---

## Conclusion

All 12 legacy models are safe to remove from `schema.prisma`. All have 0 rows in the database. None are referenced by any running code.

**However, removal is deferred from this build pass** because:

1. Prisma's migration system will attempt to `DROP TABLE` for any model removed without a `@@map` or explicit `@@ignore` — and the default migration SQL will not include `IF EXISTS`, making it potentially destructive if run against an unexpected state.
2. The migration must be written manually with `DROP TABLE IF EXISTS` guards to be safe.
3. This requires explicit approval before running against production.

---

## Required Steps for Safe Removal (Next Pass)

1. Add `@@ignore` to all 12 models **or** write a manual migration with:
   ```sql
   DROP TABLE IF EXISTS "Company" CASCADE;
   DROP TABLE IF EXISTS "Contact" CASCADE;
   DROP TABLE IF EXISTS "EmailTemplate" CASCADE;
   DROP TABLE IF EXISTS "Campaign" CASCADE;
   DROP TABLE IF EXISTS "CampaignQueueItem" CASCADE;
   DROP TABLE IF EXISTS "CampaignEvent" CASCADE;
   DROP TABLE IF EXISTS "Suppression" CASCADE;
   DROP TABLE IF EXISTS "LeadList" CASCADE;
   DROP TABLE IF EXISTS "LeadListContact" CASCADE;
   DROP TABLE IF EXISTS "SendLayerExport" CASCADE;
   DROP TABLE IF EXISTS "ActivityLog" CASCADE;
   DROP TABLE IF EXISTS "Setting" CASCADE;
   ```
2. Remove the corresponding enum definitions that are no longer referenced.
3. Run `npx prisma generate` and verify no type errors.
4. Run `npm run typecheck` and `npm run lint`.
5. Apply the migration with `npx prisma migrate deploy`.
6. **Do not run this migration without approval from the Vulpine OS operator.**

---

## Action Taken in This Pass

No models were removed. No migration was created for table drops. This review is documentation only.
