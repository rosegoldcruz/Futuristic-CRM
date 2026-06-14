import type { Prisma } from "@prisma/client";
import type { AppUser } from "@/lib/auth/access";
import { writeAuditEvent } from "@/lib/audit";
import { getPrisma } from "@/lib/prisma";
import { queueSingleEmail } from "@/lib/mail/queue";
import { normalizeEmail, renderTemplate } from "@/lib/mail/render-template";

type JsonInput = Prisma.InputJsonValue;

export type EmailEngineStats = {
  total_contacts: bigint;
  total_companies: bigint;
  total_lists: bigint;
  total_templates: bigint;
  draft_campaigns: bigint;
  queued_emails: bigint;
  failed_emails: bigint;
  suppressions: bigint;
  sent_last_7_days: bigint;
  failed_last_7_days: bigint;
};

function requireText(value: unknown, name: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function getEmailEngineStats() {
  const [stats] = await getPrisma().$queryRaw<EmailEngineStats[]>`
    SELECT
      (SELECT count(*) FROM email_contacts) AS total_contacts,
      (SELECT count(*) FROM email_companies) AS total_companies,
      (SELECT count(*) FROM email_lists WHERE status <> 'archived') AS total_lists,
      (SELECT count(*) FROM email_templates WHERE status <> 'archived') AS total_templates,
      (SELECT count(*) FROM email_campaigns WHERE status IN ('draft', 'ready', 'pending_approval')) AS draft_campaigns,
      (SELECT count(*) FROM email_queue WHERE status = 'queued') AS queued_emails,
      (SELECT count(*) FROM email_queue WHERE status = 'failed') AS failed_emails,
      (SELECT count(*) FROM email_suppressions) AS suppressions,
      (SELECT count(*) FROM email_events WHERE event_type = 'sent' AND created_at >= now() - interval '7 days') AS sent_last_7_days,
      (SELECT count(*) FROM email_events WHERE event_type IN ('failed', 'send_failed') AND created_at >= now() - interval '7 days') AS failed_last_7_days
  `;
  return stats;
}

export async function createCompany(input: Record<string, unknown>, actor: AppUser) {
  const name = requireText(input.name, "name");
  const [company] = await getPrisma().$queryRaw<Array<{ id: string }>>`
    INSERT INTO email_companies (name, domain, website, industry, source, status, notes)
    VALUES (${name}, ${optionalText(input.domain)}, ${optionalText(input.website)}, ${optionalText(input.industry)}, ${optionalText(input.source)}, ${optionalText(input.status) ?? "active"}, ${optionalText(input.notes)})
    RETURNING id::text
  `;
  await writeAuditEvent({ actor, entityType: "company", entityId: company.id, action: "create", metadata: { name } });
  return company;
}

export async function updateCompany(id: string, input: Record<string, unknown>, actor: AppUser) {
  await getPrisma().$executeRaw`
    UPDATE email_companies
    SET name = coalesce(${optionalText(input.name)}, name),
      domain = ${optionalText(input.domain)},
      website = ${optionalText(input.website)},
      industry = ${optionalText(input.industry)},
      source = ${optionalText(input.source)},
      status = coalesce(${optionalText(input.status)}, status),
      notes = ${optionalText(input.notes)},
      updated_at = now()
    WHERE id = ${id}::uuid
  `;
  await writeAuditEvent({ actor, entityType: "company", entityId: id, action: "update", metadata: input as JsonInput });
  return { id };
}

export async function listCompanies(q = "") {
  return getPrisma().$queryRaw<Array<{ id: string; name: string; domain: string | null; website: string | null; industry: string | null; status: string; contacts: bigint }>>`
    SELECT co.id::text, co.name, co.domain, co.website, co.industry, co.status, count(c.id) AS contacts
    FROM email_companies co
    LEFT JOIN email_contacts c ON c.company_id = co.id
    WHERE (${q} = '' OR co.name ILIKE ${`%${q}%`} OR co.domain ILIKE ${`%${q}%`} OR co.website ILIKE ${`%${q}%`})
    GROUP BY co.id
    ORDER BY co.updated_at DESC
    LIMIT 250
  `;
}

export async function createContact(input: Record<string, unknown>, actor: AppUser) {
  const email = normalizeEmail(optionalText(input.email));
  if (!email) throw new Error("email is required");
  const companyId = optionalText(input.company_id);
  const [suppressed] = await getPrisma().$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (SELECT 1 FROM email_suppressions WHERE email = ${email})
  `;
  const status = suppressed?.exists ? "do_not_contact" : optionalText(input.status) ?? "active";
  const [contact] = await getPrisma().$queryRaw<Array<{ id: string }>>`
    INSERT INTO email_contacts (company_id, first_name, last_name, full_name, email, phone, title, source, status, consent_status, notes)
    VALUES (${companyId}::uuid, ${optionalText(input.first_name)}, ${optionalText(input.last_name)}, ${optionalText(input.full_name)}, ${email},
      ${optionalText(input.phone)}, ${optionalText(input.title)}, ${optionalText(input.source)}, ${status}, ${optionalText(input.consent_status) ?? "unknown"}, ${optionalText(input.notes)})
    ON CONFLICT (email) DO UPDATE SET
      company_id = EXCLUDED.company_id,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      title = EXCLUDED.title,
      source = EXCLUDED.source,
      consent_status = EXCLUDED.consent_status,
      notes = EXCLUDED.notes,
      updated_at = now()
    RETURNING id::text
  `;
  await writeAuditEvent({ actor, entityType: "contact", entityId: contact.id, action: "upsert", metadata: { email } });
  return contact;
}

export async function updateContact(id: string, input: Record<string, unknown>, actor: AppUser) {
  await getPrisma().$executeRaw`
    UPDATE email_contacts
    SET company_id = ${optionalText(input.company_id)}::uuid,
      first_name = ${optionalText(input.first_name)},
      last_name = ${optionalText(input.last_name)},
      full_name = ${optionalText(input.full_name)},
      phone = ${optionalText(input.phone)},
      title = ${optionalText(input.title)},
      source = ${optionalText(input.source)},
      status = coalesce(${optionalText(input.status)}, status),
      consent_status = coalesce(${optionalText(input.consent_status)}, consent_status),
      notes = ${optionalText(input.notes)},
      updated_at = now()
    WHERE id = ${id}::uuid
  `;
  await writeAuditEvent({ actor, entityType: "contact", entityId: id, action: "update", metadata: input as JsonInput });
  return { id };
}

export async function listContacts(q = "", status = "") {
  return getPrisma().$queryRaw<
    Array<{ id: string; email: string; full_name: string | null; first_name: string | null; last_name: string | null; title: string | null; status: string; consent_status: string; company_name: string | null }>
  >`
    SELECT c.id::text, c.email, c.full_name, c.first_name, c.last_name, c.title, c.status, c.consent_status, co.name AS company_name
    FROM email_contacts c
    LEFT JOIN email_companies co ON co.id = c.company_id
    WHERE (${q} = '' OR c.email ILIKE ${`%${q}%`} OR c.full_name ILIKE ${`%${q}%`} OR co.name ILIKE ${`%${q}%`})
      AND (${status} = '' OR c.status = ${status})
    ORDER BY c.updated_at DESC
    LIMIT 250
  `;
}

export async function createList(input: Record<string, unknown>, actor: AppUser) {
  const name = requireText(input.name, "name");
  const [list] = await getPrisma().$queryRaw<Array<{ id: string }>>`
    INSERT INTO email_lists (name, description, type, status)
    VALUES (${name}, ${optionalText(input.description)}, ${optionalText(input.type) ?? "static"}, ${optionalText(input.status) ?? "active"})
    RETURNING id::text
  `;
  await writeAuditEvent({ actor, entityType: "email_list", entityId: list.id, action: "create", metadata: { name } });
  return list;
}

export async function addContactToList(listId: string, contactId: string, actor: AppUser) {
  await getPrisma().$executeRaw`
    INSERT INTO email_list_members (list_id, contact_id)
    VALUES (${listId}::uuid, ${contactId}::uuid)
    ON CONFLICT (list_id, contact_id) DO NOTHING
  `;
  await writeAuditEvent({ actor, entityType: "email_list", entityId: listId, action: "add_contact", metadata: { contactId } });
  return { listId, contactId };
}

export async function removeContactFromList(listId: string, contactId: string, actor: AppUser) {
  await getPrisma().$executeRaw`
    DELETE FROM email_list_members WHERE list_id = ${listId}::uuid AND contact_id = ${contactId}::uuid
  `;
  await writeAuditEvent({ actor, entityType: "email_list", entityId: listId, action: "remove_contact", metadata: { contactId } });
  return { listId, contactId };
}

export async function listLists() {
  return getPrisma().$queryRaw<Array<{ id: string; name: string; description: string | null; type: string; status: string; members: bigint }>>`
    SELECT l.id::text, l.name, l.description, l.type, l.status, count(m.id) AS members
    FROM email_lists l
    LEFT JOIN email_list_members m ON m.list_id = l.id
    WHERE l.status <> 'archived'
    GROUP BY l.id
    ORDER BY l.updated_at DESC
  `;
}

export async function createTemplate(input: Record<string, unknown>, actor: AppUser) {
  const name = requireText(input.name, "name");
  const subject = requireText(input.subject, "subject");
  const bodyHtml = requireText(input.body_html ?? input.body_text, "body_html");
  const [template] = await getPrisma().$queryRaw<Array<{ id: string }>>`
    INSERT INTO email_templates (name, subject, preheader, body_html, body_text, body, category, status)
    VALUES (${name}, ${subject}, ${optionalText(input.preheader)}, ${bodyHtml}, ${optionalText(input.body_text)}, ${optionalText(input.body_text)}, ${optionalText(input.category)}, ${optionalText(input.status) ?? "draft"})
    RETURNING id::text
  `;
  await writeAuditEvent({ actor, entityType: "email_template", entityId: template.id, action: "create", metadata: { name } });
  return template;
}

export async function updateTemplate(id: string, input: Record<string, unknown>, actor: AppUser) {
  await getPrisma().$executeRaw`
    UPDATE email_templates
    SET name = coalesce(${optionalText(input.name)}, name),
      subject = coalesce(${optionalText(input.subject)}, subject),
      preheader = ${optionalText(input.preheader)},
      body_html = coalesce(${optionalText(input.body_html)}, body_html),
      body_text = ${optionalText(input.body_text)},
      body = ${optionalText(input.body_text)},
      category = ${optionalText(input.category)},
      status = coalesce(${optionalText(input.status)}, status),
      updated_at = now()
    WHERE id = ${id}::uuid
  `;
  await writeAuditEvent({ actor, entityType: "email_template", entityId: id, action: "update", metadata: input as JsonInput });
  return { id };
}

export async function listTemplates() {
  return getPrisma().$queryRaw<Array<{ id: string; name: string; subject: string; status: string; body_html: string | null; body_text: string | null }>>`
    SELECT id::text, name, subject, status, body_html, body_text
    FROM email_templates
    WHERE status <> 'archived'
    ORDER BY updated_at DESC
  `;
}

export async function createCampaign(input: Record<string, unknown>, actor: AppUser) {
  const name = requireText(input.name, "name");
  const [campaign] = await getPrisma().$queryRaw<Array<{ id: string }>>`
    INSERT INTO email_campaigns (name, template_id, list_id, subject_override, status, scheduled_at)
    VALUES (${name}, ${optionalText(input.template_id)}::uuid, ${optionalText(input.list_id)}::uuid, ${optionalText(input.subject_override)}, ${optionalText(input.status) ?? "draft"}, ${optionalText(input.scheduled_at)}::timestamptz)
    RETURNING id::text
  `;
  await writeAuditEvent({ actor, entityType: "email_campaign", entityId: campaign.id, action: "create", metadata: { name } });
  return campaign;
}

export async function approveCampaign(campaignId: string, actor: AppUser) {
  await getPrisma().$executeRaw`
    UPDATE email_campaigns
    SET status = 'approved', approved_at = now(), updated_at = now()
    WHERE id = ${campaignId}::uuid
  `;
  await writeAuditEvent({ actor, entityType: "email_campaign", entityId: campaignId, action: "approve" });
  return { id: campaignId };
}

async function loadCampaign(campaignId: string) {
  const [campaign] = await getPrisma().$queryRaw<
    Array<{ id: string; template_id: string | null; list_id: string | null; subject: string | null; body_html: string | null; body_text: string | null; subject_override: string | null }>
  >`
    SELECT c.id::text, c.template_id::text, c.list_id::text, t.subject, t.body_html, t.body_text, c.subject_override
    FROM email_campaigns c
    LEFT JOIN email_templates t ON t.id = c.template_id
    WHERE c.id = ${campaignId}::uuid
    LIMIT 1
  `;
  if (!campaign) throw new Error("Campaign not found");
  return campaign;
}

export async function generateCampaignRecipients(campaignId: string, actor: AppUser) {
  const campaign = await loadCampaign(campaignId);
  if (!campaign.list_id || !campaign.template_id) throw new Error("Campaign requires a list and template");
  const contacts = await getPrisma().$queryRaw<
    Array<{ id: string; email: string; first_name: string | null; last_name: string | null; full_name: string | null; title: string | null; company_name: string | null }>
  >`
    SELECT c.id::text, c.email, c.first_name, c.last_name, c.full_name, c.title, co.name AS company_name
    FROM email_contacts c
    JOIN email_list_members lm ON lm.contact_id = c.id
    LEFT JOIN email_companies co ON co.id = c.company_id
    LEFT JOIN email_suppressions s ON s.email = c.email
    WHERE lm.list_id = ${campaign.list_id}::uuid
      AND s.email IS NULL
      AND c.status = 'active'
  `;

  for (const contact of contacts) {
    const payload = {
      firstName: contact.first_name,
      lastName: contact.last_name,
      fullName: contact.full_name,
      companyName: contact.company_name,
      email: contact.email,
      title: contact.title,
    };
    const subject = renderTemplate(campaign.subject_override ?? campaign.subject, payload);
    const html = renderTemplate(campaign.body_html, payload);
    const text = renderTemplate(campaign.body_text, payload);
    const [recipient] = await getPrisma().$queryRaw<Array<{ id: string }>>`
      INSERT INTO email_campaign_recipients (campaign_id, contact_id, status, personalized_subject, personalized_body, personalized_html, personalized_text)
      VALUES (${campaignId}::uuid, ${contact.id}::uuid, 'draft_ready', ${subject}, ${text || html}, ${html || ""}, ${text || null})
      ON CONFLICT (campaign_id, contact_id) DO UPDATE SET
        personalized_subject = EXCLUDED.personalized_subject,
        personalized_body = EXCLUDED.personalized_body,
        personalized_html = EXCLUDED.personalized_html,
        personalized_text = EXCLUDED.personalized_text,
        updated_at = now()
      RETURNING id::text
    `;
    await getPrisma().$executeRaw`
      INSERT INTO email_events (campaign_id, recipient_id, contact_id, event_type, metadata)
      VALUES (${campaignId}::uuid, ${recipient.id}::uuid, ${contact.id}::uuid, 'draft_generated', ${JSON.stringify({ source: "email_engine" })}::jsonb)
    `;
  }

  await getPrisma().$executeRaw`
    UPDATE email_campaigns SET status = 'ready', updated_at = now() WHERE id = ${campaignId}::uuid
  `;
  await writeAuditEvent({ actor, entityType: "email_campaign", entityId: campaignId, action: "generate_recipients", metadata: { count: contacts.length } });
  return { campaignId, count: contacts.length };
}

export async function queueCampaign(campaignId: string, actor: AppUser) {
  const recipients = await getPrisma().$queryRaw<
    Array<{ id: string; contact_id: string; email: string; subject: string | null; html: string | null; text: string | null }>
  >`
    SELECT r.id::text, r.contact_id::text, c.email, r.personalized_subject AS subject, r.personalized_html AS html, r.personalized_text AS text
    FROM email_campaign_recipients r
    JOIN email_contacts c ON c.id = r.contact_id
    LEFT JOIN email_suppressions s ON s.email = c.email
    WHERE r.campaign_id = ${campaignId}::uuid
      AND r.status IN ('draft_ready', 'send_failed')
      AND s.email IS NULL
      AND c.status = 'active'
  `;

  let queued = 0;
  let skippedDuplicate = 0;
  let skippedSuppressed = 0;
  for (const recipient of recipients) {
    const result = await queueSingleEmail({
      to: recipient.email,
      subject: recipient.subject ?? "",
      html: recipient.html,
      text: recipient.text,
      campaignId,
      contactId: recipient.contact_id,
      recipientId: recipient.id,
      scheduledAt: new Date(),
    });
    if (result.queued) queued += 1;
    else if (result.duplicate) skippedDuplicate += 1;
    else if (result.suppressed) skippedSuppressed += 1;
  }
  await getPrisma().$executeRaw`
    UPDATE email_campaigns SET status = 'queued', updated_at = now() WHERE id = ${campaignId}::uuid
  `;
  await writeAuditEvent({ actor, entityType: "email_campaign", entityId: campaignId, action: "queue", metadata: { queued, skippedDuplicate, skippedSuppressed } });
  return { campaignId, queued, skippedDuplicate, skippedSuppressed };
}

export async function listCampaigns() {
  return getPrisma().$queryRaw<Array<{ id: string; name: string; status: string; list_name: string | null; template_name: string | null; recipients: bigint; queued: bigint }>>`
    SELECT c.id::text, c.name, c.status, l.name AS list_name, t.name AS template_name,
      count(r.id) AS recipients,
      (SELECT count(*) FROM email_queue q WHERE q.campaign_id = c.id) AS queued
    FROM email_campaigns c
    LEFT JOIN email_lists l ON l.id = c.list_id
    LEFT JOIN email_templates t ON t.id = c.template_id
    LEFT JOIN email_campaign_recipients r ON r.campaign_id = c.id
    GROUP BY c.id, l.name, t.name
    ORDER BY c.updated_at DESC
  `;
}

export async function listQueue(status = "") {
  return getPrisma().$queryRaw<Array<{ id: string; recipient_email: string; subject: string; status: string; provider: string | null; attempt_count: number; max_attempts: number; next_attempt_at: Date | null; last_error: string | null; created_at: Date }>>`
    SELECT id::text, recipient_email, subject, status, provider, attempt_count, max_attempts, next_attempt_at, last_error, created_at
    FROM email_queue
    WHERE (${status} = '' OR status = ${status})
    ORDER BY created_at DESC
    LIMIT 250
  `;
}

export async function retryQueueItem(id: string, actor: AppUser) {
  await getPrisma().$executeRaw`
    UPDATE email_queue
    SET status = 'queued', next_attempt_at = now(), last_error = NULL, updated_at = now()
    WHERE id = ${id}::uuid
  `;
  await writeAuditEvent({ actor, entityType: "email_queue", entityId: id, action: "retry" });
  return { id };
}

export async function cancelQueueItem(id: string, actor: AppUser) {
  await getPrisma().$executeRaw`
    UPDATE email_queue SET status = 'cancelled', updated_at = now() WHERE id = ${id}::uuid
  `;
  await writeAuditEvent({ actor, entityType: "email_queue", entityId: id, action: "cancel" });
  return { id };
}

export async function addSuppression(input: Record<string, unknown>, actor: AppUser) {
  const email = normalizeEmail(optionalText(input.email));
  if (!email) throw new Error("email is required");
  const reason = requireText(input.reason, "reason");
  const [suppression] = await getPrisma().$queryRaw<Array<{ id: string }>>`
    INSERT INTO email_suppressions (email, reason, source)
    VALUES (${email}, ${reason}, ${optionalText(input.source)})
    ON CONFLICT (email) DO UPDATE SET reason = EXCLUDED.reason, source = EXCLUDED.source
    RETURNING id::text
  `;
  await writeAuditEvent({ actor, entityType: "email_suppression", entityId: suppression.id, action: "upsert", metadata: { email, reason } });
  return suppression;
}

export async function removeSuppression(id: string, actor: AppUser) {
  await getPrisma().$executeRaw`DELETE FROM email_suppressions WHERE id = ${id}::uuid`;
  await writeAuditEvent({ actor, entityType: "email_suppression", entityId: id, action: "remove" });
  return { id };
}

export async function listSuppressions() {
  return getPrisma().$queryRaw<Array<{ id: string; email: string; reason: string; source: string | null; created_at: Date }>>`
    SELECT id::text, email, reason, source, created_at
    FROM email_suppressions
    ORDER BY created_at DESC
    LIMIT 500
  `;
}
