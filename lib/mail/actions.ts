"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/access";
import { getPrisma } from "@/lib/prisma";
import { ensureSendSettings } from "@/lib/mail/data";
import { normalizeEmail, renderTemplate } from "@/lib/mail/render-template";
import { sendEmail } from "@/lib/mail/smtp";

type ActionState = { ok: boolean; message: string };

const MAIL_PATHS = ["/mail", "/mail/contacts", "/mail/companies", "/mail/lists", "/mail/templates", "/mail/campaigns", "/mail/events", "/mail/suppressions", "/mail/settings", "/mail/send"];
const UNSENDABLE_CONTACT_STATUSES = new Set(["bounced", "unsubscribed", "do_not_contact", "archived"]);

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  const text = typeof raw === "string" ? raw.trim() : "";
  return text || null;
}

function required(formData: FormData, key: string) {
  const text = value(formData, key);
  if (!text) throw new Error(`${key} is required`);
  return text;
}

function refreshMail() {
  MAIL_PATHS.forEach((path) => revalidatePath(path));
}

async function logEvent(input: {
  campaignId?: string | null;
  recipientId?: string | null;
  contactId?: string | null;
  eventType: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await getPrisma().$executeRaw`
    INSERT INTO email_events (campaign_id, recipient_id, contact_id, event_type, metadata)
    VALUES (${input.campaignId ?? null}::uuid, ${input.recipientId ?? null}::uuid, ${input.contactId ?? null}::uuid, ${input.eventType}, ${input.metadata ?? {}})
  `;
}

export async function createCompany(formData: FormData) {
  await requireActiveUser();
  await getPrisma().$executeRaw`
    INSERT INTO email_companies (name, website, phone, industry, company_type, address_line1, address_line2, city, state, postal_code, country, notes)
    VALUES (${required(formData, "name")}, ${value(formData, "website")}, ${value(formData, "phone")}, ${value(formData, "industry")},
      ${value(formData, "company_type")}, ${value(formData, "address_line1")}, ${value(formData, "address_line2")},
      ${value(formData, "city")}, ${value(formData, "state")}, ${value(formData, "postal_code")}, ${value(formData, "country") ?? "US"}, ${value(formData, "notes")})
  `;
  refreshMail();
}

export async function updateCompany(formData: FormData) {
  await requireActiveUser();
  await getPrisma().$executeRaw`
    UPDATE email_companies
    SET name = ${required(formData, "name")}, website = ${value(formData, "website")}, phone = ${value(formData, "phone")},
      industry = ${value(formData, "industry")}, company_type = ${value(formData, "company_type")}, notes = ${value(formData, "notes")}, updated_at = now()
    WHERE id = ${required(formData, "id")}::uuid
  `;
  refreshMail();
}

export async function createContact(formData: FormData) {
  await requireActiveUser();
  const email = normalizeEmail(formData.get("email"));
  if (!email) throw new Error("email is required");
  const companyId = value(formData, "company_id");
  const [suppressed] = await getPrisma().$queryRaw<Array<{ exists: boolean }>>`SELECT EXISTS (SELECT 1 FROM email_suppressions WHERE email = ${email})`;
  const status = suppressed?.exists ? "do_not_contact" : value(formData, "status") ?? "active";
  await getPrisma().$executeRaw`
    INSERT INTO email_contacts (company_id, first_name, last_name, full_name, email, phone, title, source, status, notes)
    VALUES (${companyId}::uuid, ${value(formData, "first_name")}, ${value(formData, "last_name")}, ${value(formData, "full_name")},
      ${email}, ${value(formData, "phone")}, ${value(formData, "title")}, ${value(formData, "source")}, ${status}, ${value(formData, "notes")})
    ON CONFLICT (email) DO UPDATE SET
      company_id = EXCLUDED.company_id,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      title = EXCLUDED.title,
      source = EXCLUDED.source,
      notes = EXCLUDED.notes,
      updated_at = now()
  `;
  refreshMail();
}

export async function updateContact(formData: FormData) {
  await requireActiveUser();
  await getPrisma().$executeRaw`
    UPDATE email_contacts
    SET company_id = ${value(formData, "company_id")}::uuid, first_name = ${value(formData, "first_name")},
      last_name = ${value(formData, "last_name")}, full_name = ${value(formData, "full_name")}, phone = ${value(formData, "phone")},
      title = ${value(formData, "title")}, source = ${value(formData, "source")}, status = ${value(formData, "status") ?? "active"},
      notes = ${value(formData, "notes")}, updated_at = now()
    WHERE id = ${required(formData, "id")}::uuid
  `;
  refreshMail();
}

export async function archiveContact(formData: FormData) {
  await requireActiveUser();
  await getPrisma().$executeRaw`UPDATE email_contacts SET status = 'archived', updated_at = now() WHERE id = ${required(formData, "id")}::uuid`;
  refreshMail();
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

export async function importContactsCsv(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireActiveUser();
  const file = formData.get("csv");
  if (!(file instanceof File)) return { ok: false, message: "CSV file is required" };
  const text = await file.text();
  const rows = text.split(/\r?\n/).filter((line) => line.trim());
  if (rows.length < 2) return { ok: false, message: "CSV must include headers and at least one row" };
  const headers = parseCsvLine(rows[0]).map((header) => header.trim().toLowerCase());
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const prisma = getPrisma();

  for (const [index, line] of rows.slice(1).entries()) {
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] ?? ""]));
    const email = normalizeEmail(row.email);
    if (!email) {
      errors.push(`row ${index + 2}: email is required`);
      skipped += 1;
      continue;
    }
    const [suppressed] = await prisma.$queryRaw<Array<{ exists: boolean }>>`SELECT EXISTS (SELECT 1 FROM email_suppressions WHERE email = ${email})`;
    if (suppressed?.exists) {
      skipped += 1;
      continue;
    }
    let companyId: string | null = null;
    if (row.company_name?.trim()) {
      const companyName = row.company_name.trim();
      const [existing] = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id::text AS id FROM email_companies WHERE lower(name) = lower(${companyName}) LIMIT 1
      `;
      if (existing?.id) {
        companyId = existing.id;
      } else {
        const [company] = await prisma.$queryRaw<Array<{ id: string }>>`
          INSERT INTO email_companies (name, website)
          VALUES (${companyName}, ${row.website?.trim() || null})
          RETURNING id::text
        `;
        companyId = company?.id ?? null;
      }
    }
    await prisma.$executeRaw`
      INSERT INTO email_contacts (company_id, first_name, last_name, full_name, email, phone, title, source, status, notes)
      VALUES (${companyId}::uuid, ${row.first_name || null}, ${row.last_name || null}, ${row.full_name || null}, ${email},
        ${row.phone || null}, ${row.title || null}, ${row.source || null}, 'active', ${row.notes || null})
      ON CONFLICT (email) DO UPDATE SET
        company_id = coalesce(EXCLUDED.company_id, email_contacts.company_id),
        first_name = coalesce(EXCLUDED.first_name, email_contacts.first_name),
        last_name = coalesce(EXCLUDED.last_name, email_contacts.last_name),
        full_name = coalesce(EXCLUDED.full_name, email_contacts.full_name),
        phone = coalesce(EXCLUDED.phone, email_contacts.phone),
        title = coalesce(EXCLUDED.title, email_contacts.title),
        source = coalesce(EXCLUDED.source, email_contacts.source),
        notes = coalesce(EXCLUDED.notes, email_contacts.notes),
        updated_at = now()
    `;
    imported += 1;
  }
  refreshMail();
  return { ok: errors.length === 0, message: `Imported ${imported}. Skipped ${skipped}. Errors ${errors.length}${errors.length ? `: ${errors.slice(0, 3).join("; ")}` : ""}` };
}

export async function createList(formData: FormData) {
  await requireActiveUser();
  await getPrisma().$executeRaw`INSERT INTO email_lists (name, description) VALUES (${required(formData, "name")}, ${value(formData, "description")})`;
  refreshMail();
}

export async function addContactToList(formData: FormData) {
  await requireActiveUser();
  await getPrisma().$executeRaw`
    INSERT INTO email_list_members (list_id, contact_id)
    VALUES (${required(formData, "list_id")}::uuid, ${required(formData, "contact_id")}::uuid)
    ON CONFLICT (list_id, contact_id) DO NOTHING
  `;
  refreshMail();
}

export async function removeContactFromList(formData: FormData) {
  await requireActiveUser();
  await getPrisma().$executeRaw`DELETE FROM email_list_members WHERE list_id = ${required(formData, "list_id")}::uuid AND contact_id = ${required(formData, "contact_id")}::uuid`;
  refreshMail();
}

export async function createTemplate(formData: FormData) {
  await requireActiveUser();
  await getPrisma().$executeRaw`
    INSERT INTO email_templates (name, subject, body, body_html, body_text, category)
    VALUES (${required(formData, "name")}, ${required(formData, "subject")}, ${value(formData, "body_text")},
      ${value(formData, "body_html")}, ${value(formData, "body_text")}, ${value(formData, "category")})
  `;
  refreshMail();
}

export async function updateTemplate(formData: FormData) {
  await requireActiveUser();
  await getPrisma().$executeRaw`
    UPDATE email_templates
    SET name = ${required(formData, "name")}, subject = ${required(formData, "subject")}, body = ${value(formData, "body_text")},
      body_html = ${value(formData, "body_html")}, body_text = ${value(formData, "body_text")}, category = ${value(formData, "category")}, updated_at = now()
    WHERE id = ${required(formData, "id")}::uuid
  `;
  refreshMail();
}

export async function createCampaign(formData: FormData) {
  await requireActiveUser();
  const [campaign] = await getPrisma().$queryRaw<Array<{ id: string }>>`
    INSERT INTO email_campaigns (name, template_id, list_id, status)
    VALUES (${required(formData, "name")}, ${value(formData, "template_id")}::uuid, ${value(formData, "list_id")}::uuid, ${value(formData, "status") ?? "draft"})
    RETURNING id::text
  `;
  refreshMail();
  redirect(`/mail/campaigns/${campaign.id}`);
}

async function loadCampaign(campaignId: string) {
  const [campaign] = await getPrisma().$queryRaw<
    Array<{ id: string; template_id: string | null; list_id: string | null; subject: string | null; body_html: string | null; body_text: string | null }>
  >`
    SELECT c.id::text, c.template_id::text, c.list_id::text, t.subject, t.body_html, t.body_text
    FROM email_campaigns c
    LEFT JOIN email_templates t ON t.id = c.template_id
    WHERE c.id = ${campaignId}::uuid
    LIMIT 1
  `;
  if (!campaign) throw new Error("Campaign not found");
  return campaign;
}

export async function generateCampaignRecipients(formData: FormData) {
  await requireActiveUser();
  const campaignId = required(formData, "campaign_id");
  const campaign = await loadCampaign(campaignId);
  if (!campaign.list_id || !campaign.template_id) throw new Error("Campaign requires a list and template");
  const contacts = await getPrisma().$queryRaw<
    Array<{ id: string; email: string; first_name: string | null; last_name: string | null; full_name: string | null; title: string | null; company_name: string | null; status: string }>
  >`
    SELECT c.id::text, c.email, c.first_name, c.last_name, c.full_name, c.title, co.name AS company_name, c.status
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
    const subject = renderTemplate(campaign.subject, payload);
    const html = renderTemplate(campaign.body_html, payload);
    const text = renderTemplate(campaign.body_text, payload);
    const [recipient] = await getPrisma().$queryRaw<Array<{ id: string }>>`
      INSERT INTO email_campaign_recipients (campaign_id, contact_id, status, personalized_subject, personalized_body, personalized_html, personalized_text)
      VALUES (${campaignId}::uuid, ${contact.id}::uuid, 'draft_ready', ${subject}, ${text || html}, ${html || null}, ${text || null})
      ON CONFLICT (campaign_id, contact_id) DO UPDATE SET
        personalized_subject = EXCLUDED.personalized_subject,
        personalized_body = EXCLUDED.personalized_body,
        personalized_html = EXCLUDED.personalized_html,
        personalized_text = EXCLUDED.personalized_text,
        updated_at = now()
      RETURNING id::text
    `;
    await logEvent({ campaignId, recipientId: recipient.id, contactId: contact.id, eventType: "draft_generated" });
  }
  await getPrisma().$executeRaw`UPDATE email_campaigns SET status = 'ready', updated_at = now() WHERE id = ${campaignId}::uuid`;
  refreshMail();
}

async function canSendTo(email: string, contactStatus?: string | null) {
  if (contactStatus && UNSENDABLE_CONTACT_STATUSES.has(contactStatus)) return `Contact status is ${contactStatus}`;
  const [suppressed] = await getPrisma().$queryRaw<Array<{ reason: string }>>`SELECT reason FROM email_suppressions WHERE email = ${email} LIMIT 1`;
  return suppressed ? `Email suppressed: ${suppressed.reason}` : null;
}

export async function sendSingleEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireActiveUser();
  const settings = await ensureSendSettings();
  if (!settings.enabled) return { ok: false, message: "Sending disabled in /mail/settings" };
  const to = normalizeEmail(formData.get("to"));
  if (!to) return { ok: false, message: "to is required" };
  const subject = required(formData, "subject");
  const html = value(formData, "html");
  const text = value(formData, "text");
  const contactId = value(formData, "contact_id");
  const campaignId = value(formData, "campaign_id");
  const recipientId = value(formData, "recipient_id");
  const blocked = await canSendTo(to);
  if (blocked) return { ok: false, message: blocked };
  await logEvent({ campaignId, recipientId, contactId, eventType: "send_attempted", metadata: { to, subject } });
  const result = await sendEmail({ to, subject, html: html ?? undefined, text: text ?? undefined });
  if (result.ok) {
    if (recipientId) {
      await getPrisma().$executeRaw`
        UPDATE email_campaign_recipients
        SET status = 'sent', sent_at = now(), provider_message_id = ${result.messageId ?? null}, last_error = NULL, updated_at = now()
        WHERE id = ${recipientId}::uuid
      `;
    }
    await logEvent({ campaignId, recipientId, contactId, eventType: "sent", metadata: { messageId: result.messageId, response: result.response } });
    refreshMail();
    return { ok: true, message: `Sent${result.messageId ? `: ${result.messageId}` : ""}` };
  }
  if (recipientId) {
    await getPrisma().$executeRaw`
      UPDATE email_campaign_recipients
      SET status = 'send_failed', last_error = ${result.error ?? "Send failed"}, updated_at = now()
      WHERE id = ${recipientId}::uuid
    `;
  }
  await logEvent({ campaignId, recipientId, contactId, eventType: "send_failed", metadata: { error: result.error } });
  refreshMail();
  return { ok: false, message: result.error ?? "Send failed" };
}

export async function sendCampaignBatch(formData: FormData) {
  await requireActiveUser();
  const campaignId = required(formData, "campaign_id");
  const settings = await ensureSendSettings();
  if (!settings.enabled) throw new Error("Sending disabled in /mail/settings");
  const [today] = await getPrisma().$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*) FROM email_events WHERE event_type = 'sent' AND created_at >= current_date
  `;
  const remaining = Math.max(0, settings.daily_limit - Number(today.count));
  const limit = Math.min(settings.batch_size, remaining);
  if (limit <= 0) throw new Error("Daily send limit reached");
  const recipients = await getPrisma().$queryRaw<
    Array<{ id: string; contact_id: string; email: string; status: string; contact_status: string; personalized_subject: string | null; personalized_html: string | null; personalized_text: string | null }>
  >`
    SELECT r.id::text, r.contact_id::text, c.email, r.status, c.status AS contact_status, r.personalized_subject, r.personalized_html, r.personalized_text
    FROM email_campaign_recipients r
    JOIN email_contacts c ON c.id = r.contact_id
    WHERE r.campaign_id = ${campaignId}::uuid
      AND r.status IN ('draft_ready', 'send_failed')
    ORDER BY r.created_at ASC
    LIMIT ${limit}
  `;
  let sent = 0;
  let failed = 0;
  let suppressed = 0;
  for (const recipient of recipients) {
    const blocked = await canSendTo(recipient.email, recipient.contact_status);
    if (blocked) {
      suppressed += 1;
      await getPrisma().$executeRaw`UPDATE email_campaign_recipients SET status = 'suppressed', last_error = ${blocked}, updated_at = now() WHERE id = ${recipient.id}::uuid`;
      await logEvent({ campaignId, recipientId: recipient.id, contactId: recipient.contact_id, eventType: "status_changed", metadata: { status: "suppressed", reason: blocked } });
      continue;
    }
    await logEvent({ campaignId, recipientId: recipient.id, contactId: recipient.contact_id, eventType: "send_attempted", metadata: { to: recipient.email } });
    await getPrisma().$executeRaw`UPDATE email_campaign_recipients SET status = 'sending', updated_at = now() WHERE id = ${recipient.id}::uuid`;
    const result = await sendEmail({
      to: recipient.email,
      subject: recipient.personalized_subject ?? "",
      html: recipient.personalized_html ?? undefined,
      text: recipient.personalized_text ?? undefined,
    });
    if (result.ok) {
      sent += 1;
      await getPrisma().$executeRaw`
        UPDATE email_campaign_recipients SET status = 'sent', sent_at = now(), provider_message_id = ${result.messageId ?? null}, last_error = NULL, updated_at = now()
        WHERE id = ${recipient.id}::uuid
      `;
      await logEvent({ campaignId, recipientId: recipient.id, contactId: recipient.contact_id, eventType: "sent", metadata: { messageId: result.messageId } });
    } else {
      failed += 1;
      await getPrisma().$executeRaw`
        UPDATE email_campaign_recipients SET status = 'send_failed', last_error = ${result.error ?? "Send failed"}, updated_at = now()
        WHERE id = ${recipient.id}::uuid
      `;
      await logEvent({ campaignId, recipientId: recipient.id, contactId: recipient.contact_id, eventType: "send_failed", metadata: { error: result.error } });
    }
  }
  refreshMail();
}

export async function updateRecipientStatus(formData: FormData) {
  await requireActiveUser();
  const status = required(formData, "status");
  const id = required(formData, "id");
  const updates =
    status === "replied"
      ? Prisma.sql`status = ${status}, replied_at = now(), updated_at = now()`
      : status === "follow_up_needed"
        ? Prisma.sql`status = ${status}, next_follow_up_at = ${value(formData, "next_follow_up_at")}::timestamptz, updated_at = now()`
        : Prisma.sql`status = ${status}, updated_at = now()`;
  await getPrisma().$executeRaw`UPDATE email_campaign_recipients SET ${updates} WHERE id = ${id}::uuid`;
  const [recipient] = await getPrisma().$queryRaw<Array<{ campaign_id: string; contact_id: string }>>`
    SELECT campaign_id::text, contact_id::text FROM email_campaign_recipients WHERE id = ${id}::uuid
  `;
  await logEvent({ campaignId: recipient?.campaign_id, recipientId: id, contactId: recipient?.contact_id, eventType: status === "replied" ? "replied" : "status_changed", metadata: { status } });
  refreshMail();
}

export async function addRecipientNote(formData: FormData) {
  await requireActiveUser();
  const id = required(formData, "id");
  const note = required(formData, "note");
  await getPrisma().$executeRaw`UPDATE email_campaign_recipients SET notes = concat_ws(E'\n', notes, ${note}), updated_at = now() WHERE id = ${id}::uuid`;
  const [recipient] = await getPrisma().$queryRaw<Array<{ campaign_id: string; contact_id: string }>>`
    SELECT campaign_id::text, contact_id::text FROM email_campaign_recipients WHERE id = ${id}::uuid
  `;
  await logEvent({ campaignId: recipient?.campaign_id, recipientId: id, contactId: recipient?.contact_id, eventType: "note_added", metadata: { note } });
  refreshMail();
}

export async function addSuppression(formData: FormData) {
  await requireActiveUser();
  const email = normalizeEmail(formData.get("email"));
  if (!email) throw new Error("email is required");
  const reason = required(formData, "reason");
  await getPrisma().$executeRaw`
    INSERT INTO email_suppressions (email, reason, source)
    VALUES (${email}, ${reason}, ${value(formData, "source")})
    ON CONFLICT (email) DO UPDATE SET reason = EXCLUDED.reason, source = EXCLUDED.source
  `;
  await getPrisma().$executeRaw`
    UPDATE email_contacts
    SET status = CASE
      WHEN ${reason} = 'bounced' THEN 'bounced'
      WHEN ${reason} = 'unsubscribed' THEN 'unsubscribed'
      ELSE 'do_not_contact'
    END,
    updated_at = now()
    WHERE email = ${email}
  `;
  refreshMail();
}

export async function removeSuppression(formData: FormData) {
  await requireActiveUser();
  await getPrisma().$executeRaw`DELETE FROM email_suppressions WHERE id = ${required(formData, "id")}::uuid`;
  refreshMail();
}

export async function updateSendSettings(formData: FormData) {
  await requireActiveUser();
  const settings = await ensureSendSettings();
  await getPrisma().$executeRaw`
    UPDATE email_send_settings
    SET enabled = ${formData.get("enabled") === "on"},
      daily_limit = ${Number(value(formData, "daily_limit") ?? 25)},
      batch_size = ${Number(value(formData, "batch_size") ?? 5)},
      min_seconds_between_sends = ${Number(value(formData, "min_seconds_between_sends") ?? 60)},
      updated_at = now()
    WHERE id = ${settings.id}::uuid
  `;
  refreshMail();
}
