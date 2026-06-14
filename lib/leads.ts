import { Prisma } from "@prisma/client";
import type { AppUser } from "@/lib/auth/access";
import { writeAuditEvent } from "@/lib/audit";
import { getPrisma } from "@/lib/prisma";

export const LEAD_STATUSES = [
  "new",
  "attempted_contact",
  "contacted",
  "qualified",
  "proposal_needed",
  "proposal_sent",
  "follow_up",
  "won",
  "lost",
  "do_not_contact",
] as const;

export const INTEREST_LEVELS = ["hot", "warm", "cold", "unknown"] as const;

type LeadStatus = (typeof LEAD_STATUSES)[number];
type InterestLevel = (typeof INTEREST_LEVELS)[number];
type JsonInput = Prisma.InputJsonValue;

export type LeadInput = Record<string, unknown>;

export type LeadListFilters = {
  search?: string;
  status?: string;
  source?: string;
  campaign?: string;
  assignedTo?: string;
  interestLevel?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  dir?: string;
};

function trim(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeEmail(value: unknown) {
  return trim(value)?.toLowerCase() ?? null;
}

export function normalizePhoneForDedupe(value: unknown) {
  const text = trim(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  return digits || null;
}

function validateStatus(value: unknown): LeadStatus {
  const status = trim(value) ?? "new";
  if (!LEAD_STATUSES.includes(status as LeadStatus)) throw new Error(`Invalid lead status: ${status}`);
  return status as LeadStatus;
}

function validateInterestLevel(value: unknown): InterestLevel {
  const interest = trim(value) ?? "unknown";
  if (!INTEREST_LEVELS.includes(interest as InterestLevel)) throw new Error(`Invalid interest level: ${interest}`);
  return interest as InterestLevel;
}

function parseDate(value: unknown) {
  const text = trim(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid datetime: ${text}`);
  return date;
}

function parseDecimal(value: unknown) {
  const text = trim(value);
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number)) throw new Error(`Invalid estimated value: ${text}`);
  return number;
}

function leadSortClause(sort?: string, dir?: string) {
  const direction = dir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const sortMap: Record<string, Prisma.Sql> = {
    name: Prisma.sql`lower(concat_ws(' ', l.first_name, l.last_name))`,
    company: Prisma.sql`lower(coalesce(l.company_name, co.name, ''))`,
    phone: Prisma.sql`lower(coalesce(l.phone, ''))`,
    email: Prisma.sql`lower(coalesce(l.email, ''))`,
    status: Prisma.sql`l.status`,
    source: Prisma.sql`lower(coalesce(l.source, ''))`,
    assignedTo: Prisma.sql`lower(coalesce(l.assigned_to, ''))`,
    estimatedValue: Prisma.sql`l.estimated_value`,
    lastContactedAt: Prisma.sql`l.last_contacted_at`,
    createdAt: Prisma.sql`l.created_at`,
    updatedAt: Prisma.sql`l.updated_at`,
  };
  const column = sortMap[sort ?? "createdAt"] ?? sortMap.createdAt;
  return Prisma.sql`${column} ${direction} NULLS LAST, l.created_at DESC`;
}

function leadWhereClause(input: {
  search: string;
  status: string;
  source: string;
  campaign: string;
  assignedTo: string;
  interestLevel: string;
}) {
  const searchPattern = `%${input.search}%`;
  return Prisma.sql`
    l.archived_at IS NULL
      AND (${input.search} = '' OR l.email ILIKE ${searchPattern} OR l.phone ILIKE ${searchPattern} OR l.company_name ILIKE ${searchPattern} OR l.notes ILIKE ${searchPattern} OR concat_ws(' ', l.first_name, l.last_name) ILIKE ${searchPattern})
      AND (${input.status} = '' OR l.status = ${input.status})
      AND (${input.source} = '' OR l.source = ${input.source})
      AND (${input.campaign} = '' OR l.campaign = ${input.campaign})
      AND (${input.assignedTo} = '' OR l.assigned_to = ${input.assignedTo})
      AND (${input.interestLevel} = '' OR l.interest_level = ${input.interestLevel})
  `;
}

export async function addLeadEvent(leadId: string, eventType: string, metadata?: JsonInput) {
  await getPrisma().$executeRaw`
    INSERT INTO lead_events (lead_id, event_type, metadata)
    VALUES (${leadId}::uuid, ${eventType}, ${metadata ?? {}})
  `;
}

export async function dedupeLeadByEmailOrPhone(input: LeadInput, excludeLeadId?: string) {
  const email = normalizeEmail(input.email);
  const phoneDigits = normalizePhoneForDedupe(input.phone);

  if (!email && !phoneDigits) return null;

  const [existing] = await getPrisma().$queryRaw<Array<{ id: string; email: string | null; phone: string | null; reason: string }>>`
    SELECT id::text, email, phone,
      CASE
        WHEN ${email}::text IS NOT NULL AND email = ${email} THEN 'email'
        ELSE 'phone'
      END AS reason
    FROM leads
    WHERE archived_at IS NULL
      AND (${excludeLeadId ?? null}::uuid IS NULL OR id <> ${excludeLeadId ?? null}::uuid)
      AND (
        (${email}::text IS NOT NULL AND email = ${email})
        OR (${phoneDigits}::text IS NOT NULL AND regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = ${phoneDigits})
      )
    LIMIT 1
  `;

  return existing ?? null;
}

export async function listLeads(filters: LeadListFilters = {}) {
  const search = trim(filters.search) ?? "";
  const status = trim(filters.status) ?? "";
  const source = trim(filters.source) ?? "";
  const campaign = trim(filters.campaign) ?? "";
  const assignedTo = trim(filters.assignedTo) ?? "";
  const interestLevel = trim(filters.interestLevel) ?? "";
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 250);
  const offset = Math.max(filters.offset ?? 0, 0);
  const where = leadWhereClause({ search, status, source, campaign, assignedTo, interestLevel });
  const orderBy = leadSortClause(filters.sort, filters.dir);

  return getPrisma().$queryRaw<
    Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
      company_name: string | null;
      title: string | null;
      source: string | null;
      campaign: string | null;
      status: string;
      interest_level: string;
      assigned_to: string | null;
      estimated_value: string | null;
      last_contacted_at: Date | null;
      next_follow_up_at: Date | null;
      notes: string | null;
      company_id: string | null;
      contact_id: string | null;
      linked_company_name: string | null;
      linked_contact_email: string | null;
      recent_notes: Array<{ id: string; body: string; created_at: string; created_by: string | null }>;
      created_at: Date;
      updated_at: Date;
    }>
  >`
    SELECT l.id::text, l.first_name, l.last_name, l.email, l.phone, l.company_name, l.title, l.source, l.campaign,
      l.status, l.interest_level, l.assigned_to, l.estimated_value::text, l.last_contacted_at, l.next_follow_up_at,
      l.notes, l.company_id::text, l.contact_id::text, co.name AS linked_company_name, c.email AS linked_contact_email,
      coalesce(notes.recent_notes, '[]'::jsonb) AS recent_notes,
      l.created_at, l.updated_at
    FROM leads l
    LEFT JOIN email_companies co ON co.id = l.company_id
    LEFT JOIN email_contacts c ON c.id = l.contact_id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ranked.id::text,
          'body', ranked.body,
          'created_at', ranked.created_at,
          'created_by', ranked.created_by
        )
        ORDER BY ranked.created_at DESC
      ) AS recent_notes
      FROM (
        SELECT id, body, created_at, created_by
        FROM lead_notes
        WHERE lead_id = l.id
        ORDER BY created_at DESC
        LIMIT 5
      ) ranked
    ) notes ON true
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ${limit}
    OFFSET ${offset}
  `;
}

export async function countLeads(filters: LeadListFilters = {}) {
  const search = trim(filters.search) ?? "";
  const status = trim(filters.status) ?? "";
  const source = trim(filters.source) ?? "";
  const campaign = trim(filters.campaign) ?? "";
  const assignedTo = trim(filters.assignedTo) ?? "";
  const interestLevel = trim(filters.interestLevel) ?? "";
  const where = leadWhereClause({ search, status, source, campaign, assignedTo, interestLevel });
  const [row] = await getPrisma().$queryRaw<Array<{ total: bigint }>>`
    SELECT count(*) AS total
    FROM leads l
    LEFT JOIN email_companies co ON co.id = l.company_id
    WHERE ${where}
  `;
  return Number(row?.total ?? 0);
}

export async function getLead(id: string) {
  const [lead] = await getPrisma().$queryRaw<Array<{ id: string } & Record<string, unknown>>>`
    SELECT l.*, l.id::text AS id, l.company_id::text AS company_id, l.contact_id::text AS contact_id
    FROM leads l
    WHERE l.id = ${id}::uuid AND l.archived_at IS NULL
    LIMIT 1
  `;
  if (!lead) throw new Error("Lead not found");
  return lead;
}

export async function createLead(input: LeadInput, actor: AppUser) {
  const email = normalizeEmail(input.email);
  const duplicate = await dedupeLeadByEmailOrPhone({ ...input, email });
  if (duplicate) {
    return { duplicate: true, lead: duplicate, message: `Duplicate lead found by ${duplicate.reason}` };
  }

  const status = validateStatus(input.status);
  const interestLevel = validateInterestLevel(input.interestLevel ?? input.interest_level);
  const [lead] = await getPrisma().$queryRaw<Array<{ id: string }>>`
    INSERT INTO leads (
      first_name, last_name, email, phone, company_name, title, source, campaign, status, interest_level,
      assigned_to, estimated_value, last_contacted_at, next_follow_up_at, notes
    )
    VALUES (
      ${trim(input.firstName ?? input.first_name)}, ${trim(input.lastName ?? input.last_name)}, ${email}, ${trim(input.phone)},
      ${trim(input.companyName ?? input.company_name)}, ${trim(input.title)}, ${trim(input.source)}, ${trim(input.campaign)},
      ${status}, ${interestLevel}, ${trim(input.assignedTo ?? input.assigned_to)}, ${parseDecimal(input.estimatedValue ?? input.estimated_value)},
      ${parseDate(input.lastContactedAt ?? input.last_contacted_at)}, ${parseDate(input.nextFollowUpAt ?? input.next_follow_up_at)}, ${trim(input.notes)}
    )
    RETURNING id::text
  `;
  await addLeadEvent(lead.id, "created", { source: "crm" });
  await writeAuditEvent({ actor, entityType: "lead", entityId: lead.id, action: "create", metadata: { email, status, interestLevel } });
  return { duplicate: false, lead };
}

export async function updateLead(id: string, input: LeadInput, actor: AppUser) {
  await getLead(id);
  const email = normalizeEmail(input.email);
  const duplicate = await dedupeLeadByEmailOrPhone({ ...input, email }, id);
  if (duplicate) {
    return { duplicate: true, lead: duplicate, message: `Duplicate lead found by ${duplicate.reason}` };
  }
  const status = input.status === undefined ? null : validateStatus(input.status);
  const interestLevel = input.interestLevel === undefined && input.interest_level === undefined ? null : validateInterestLevel(input.interestLevel ?? input.interest_level);

  await getPrisma().$executeRaw`
    UPDATE leads
    SET first_name = ${trim(input.firstName ?? input.first_name)},
      last_name = ${trim(input.lastName ?? input.last_name)},
      email = ${email},
      phone = ${trim(input.phone)},
      company_name = ${trim(input.companyName ?? input.company_name)},
      title = ${trim(input.title)},
      source = ${trim(input.source)},
      campaign = ${trim(input.campaign)},
      status = coalesce(${status}, status),
      interest_level = coalesce(${interestLevel}, interest_level),
      assigned_to = ${trim(input.assignedTo ?? input.assigned_to)},
      estimated_value = ${parseDecimal(input.estimatedValue ?? input.estimated_value)},
      last_contacted_at = ${parseDate(input.lastContactedAt ?? input.last_contacted_at)},
      next_follow_up_at = ${parseDate(input.nextFollowUpAt ?? input.next_follow_up_at)},
      notes = ${trim(input.notes)},
      updated_at = now()
    WHERE id = ${id}::uuid
  `;
  await addLeadEvent(id, "updated", { fields: Object.keys(input) });
  await writeAuditEvent({ actor, entityType: "lead", entityId: id, action: "update", metadata: { fields: Object.keys(input) } });
  return { duplicate: false, lead: { id } };
}

export async function archiveLead(id: string, actor: AppUser) {
  await getLead(id);
  await getPrisma().$executeRaw`UPDATE leads SET archived_at = now(), updated_at = now() WHERE id = ${id}::uuid`;
  await addLeadEvent(id, "archived", {});
  await writeAuditEvent({ actor, entityType: "lead", entityId: id, action: "archive" });
  return { id };
}

export async function addLeadNote(leadId: string, body: string, actor: AppUser) {
  await getLead(leadId);
  const cleanBody = trim(body);
  if (!cleanBody) throw new Error("note body is required");
  const [note] = await getPrisma().$queryRaw<Array<{ id: string }>>`
    INSERT INTO lead_notes (lead_id, body, created_by)
    VALUES (${leadId}::uuid, ${cleanBody}, ${actor.email})
    RETURNING id::text
  `;
  await addLeadEvent(leadId, "note_added", { noteId: note.id });
  await writeAuditEvent({ actor, entityType: "lead", entityId: leadId, action: "note_added", metadata: { noteId: note.id } });
  return note;
}

export async function assignLead(leadId: string, assignedTo: string, actor: AppUser) {
  await getLead(leadId);
  const cleanAssignedTo = trim(assignedTo);
  if (!cleanAssignedTo) throw new Error("assignedTo is required");
  const [assignment] = await getPrisma().$queryRaw<Array<{ id: string }>>`
    INSERT INTO lead_assignments (lead_id, assigned_to, assigned_by)
    VALUES (${leadId}::uuid, ${cleanAssignedTo}, ${actor.email})
    RETURNING id::text
  `;
  await getPrisma().$executeRaw`UPDATE leads SET assigned_to = ${cleanAssignedTo}, updated_at = now() WHERE id = ${leadId}::uuid`;
  await addLeadEvent(leadId, "assigned", { assignedTo: cleanAssignedTo, assignmentId: assignment.id });
  await writeAuditEvent({ actor, entityType: "lead", entityId: leadId, action: "assign", metadata: { assignedTo: cleanAssignedTo } });
  return assignment;
}

export async function updateLeadStatus(leadId: string, status: string, actor: AppUser) {
  await getLead(leadId);
  const nextStatus = validateStatus(status);
  await getPrisma().$executeRaw`
    UPDATE leads
    SET status = ${nextStatus},
      last_contacted_at = CASE WHEN ${nextStatus} IN ('attempted_contact', 'contacted') THEN now() ELSE last_contacted_at END,
      updated_at = now()
    WHERE id = ${leadId}::uuid
  `;
  await addLeadEvent(leadId, "status_changed", { status: nextStatus });
  await writeAuditEvent({ actor, entityType: "lead", entityId: leadId, action: "status_changed", metadata: { status: nextStatus } });
  return { id: leadId, status: nextStatus };
}

export async function convertLeadToContactAndCompany(leadId: string, actor: AppUser) {
  const lead = await getLead(leadId) as {
    id: string;
    company_id: string | null;
    contact_id: string | null;
    company_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    title: string | null;
    source: string | null;
    notes: string | null;
  };

  let companyId = lead.company_id;
  if (!companyId && lead.company_name) {
    const [existing] = await getPrisma().$queryRaw<Array<{ id: string }>>`
      SELECT id::text FROM email_companies WHERE lower(name) = lower(${lead.company_name}) LIMIT 1
    `;
    if (existing?.id) {
      companyId = existing.id;
    } else {
      const [company] = await getPrisma().$queryRaw<Array<{ id: string }>>`
        INSERT INTO email_companies (name, source, notes)
        VALUES (${lead.company_name}, ${lead.source}, ${lead.notes})
        RETURNING id::text
      `;
      companyId = company.id;
    }
  }

  let contactId = lead.contact_id;
  if (!contactId && lead.email) {
    const [contact] = await getPrisma().$queryRaw<Array<{ id: string }>>`
      INSERT INTO email_contacts (company_id, first_name, last_name, full_name, email, phone, title, source, status, notes)
      VALUES (${companyId}::uuid, ${lead.first_name}, ${lead.last_name}, ${[lead.first_name, lead.last_name].filter(Boolean).join(" ") || null}, ${lead.email}, ${lead.phone}, ${lead.title}, ${lead.source}, 'active', ${lead.notes})
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
      RETURNING id::text
    `;
    contactId = contact.id;
  }

  await getPrisma().$executeRaw`
    UPDATE leads SET company_id = ${companyId}::uuid, contact_id = ${contactId}::uuid, status = 'qualified', updated_at = now()
    WHERE id = ${leadId}::uuid
  `;
  await addLeadEvent(leadId, "converted", { companyId, contactId });
  await writeAuditEvent({ actor, entityType: "lead", entityId: leadId, action: "convert", metadata: { companyId, contactId } });
  return { leadId, companyId, contactId };
}
