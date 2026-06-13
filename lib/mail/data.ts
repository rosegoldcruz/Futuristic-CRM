import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";

export type SelectOption = { id: string; name: string };

export async function getMailDashboard() {
  const prisma = getPrisma();
  const [rows, events] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        total_contacts: bigint;
        active_contacts: bigint;
        suppressed_contacts: bigint;
        campaigns: bigint;
        draft_ready: bigint;
        followups_due: bigint;
        replies_logged: bigint;
        sent_today: bigint;
        failed_today: bigint;
        sending_enabled: boolean | null;
      }>
    >`
      SELECT
        (SELECT count(*) FROM email_contacts) AS total_contacts,
        (SELECT count(*) FROM email_contacts WHERE status = 'active') AS active_contacts,
        (SELECT count(*) FROM email_suppressions) AS suppressed_contacts,
        (SELECT count(*) FROM email_campaigns) AS campaigns,
        (SELECT count(*) FROM email_campaign_recipients WHERE status = 'draft_ready') AS draft_ready,
        (SELECT count(*) FROM email_campaign_recipients WHERE next_follow_up_at <= now()) AS followups_due,
        (SELECT count(*) FROM email_events WHERE event_type = 'replied') AS replies_logged,
        (SELECT count(*) FROM email_events WHERE event_type = 'sent' AND created_at >= current_date) AS sent_today,
        (SELECT count(*) FROM email_events WHERE event_type = 'send_failed' AND created_at >= current_date) AS failed_today,
        (SELECT enabled FROM email_send_settings ORDER BY created_at ASC LIMIT 1) AS sending_enabled
    `,
    getRecentEvents(12),
  ]);

  return { stats: rows[0], events };
}

export async function getRecentEvents(limit = 50) {
  return getPrisma().$queryRaw<
    Array<{ id: string; event_type: string; created_at: Date; metadata: Prisma.JsonValue; contact_email: string | null; campaign_name: string | null }>
  >`
    SELECT e.id, e.event_type, e.created_at, e.metadata, c.email AS contact_email, ca.name AS campaign_name
    FROM email_events e
    LEFT JOIN email_contacts c ON c.id = e.contact_id
    LEFT JOIN email_campaigns ca ON ca.id = e.campaign_id
    ORDER BY e.created_at DESC
    LIMIT ${limit}
  `;
}

export async function getOptions() {
  const prisma = getPrisma();
  const [contacts, companies, lists, templates, campaigns] = await Promise.all([
    prisma.$queryRaw<SelectOption[]>`SELECT id::text AS id, coalesce(full_name, email) AS name FROM email_contacts ORDER BY created_at DESC LIMIT 500`,
    prisma.$queryRaw<SelectOption[]>`SELECT id::text AS id, name FROM email_companies ORDER BY name LIMIT 500`,
    prisma.$queryRaw<SelectOption[]>`SELECT id::text AS id, name FROM email_lists ORDER BY name LIMIT 500`,
    prisma.$queryRaw<SelectOption[]>`SELECT id::text AS id, name FROM email_templates ORDER BY name LIMIT 500`,
    prisma.$queryRaw<SelectOption[]>`SELECT id::text AS id, name FROM email_campaigns ORDER BY created_at DESC LIMIT 500`,
  ]);
  return { contacts, companies, lists, templates, campaigns };
}

export async function ensureSendSettings() {
  const prisma = getPrisma();
  await prisma.$executeRaw`
    INSERT INTO email_send_settings (daily_limit, batch_size, min_seconds_between_sends, enabled)
    SELECT 25, 5, 60, false
    WHERE NOT EXISTS (SELECT 1 FROM email_send_settings)
  `;
  const [settings] = await prisma.$queryRaw<Array<{ id: string; daily_limit: number; batch_size: number; min_seconds_between_sends: number; enabled: boolean }>>`
    SELECT id::text AS id, daily_limit, batch_size, min_seconds_between_sends, enabled
    FROM email_send_settings
    ORDER BY created_at ASC
    LIMIT 1
  `;
  return settings;
}
