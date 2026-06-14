import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";

export const CONTACT_STATUSES = ["active", "bounced", "unsubscribed", "do_not_contact", "archived"] as const;

export type ContactListFilters = {
  search?: string;
  status?: string;
  source?: string;
  company?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  dir?: string;
};

export type ContactRecord = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string;
  phone: string | null;
  title: string | null;
  source: string | null;
  status: string;
  consent_status: string;
  company_id: string | null;
  company_name: string | null;
  company_status: string | null;
  company_type: string | null;
  notes: string | null;
  related_leads_count: number;
  last_activity_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type ContactLeadSummary = {
  id: string;
  name: string | null;
  status: string;
  source: string | null;
  estimated_value: string | null;
  updated_at: Date;
};

function trim(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function contactSortClause(sort?: string, dir?: string) {
  const direction = dir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const sortMap: Record<string, Prisma.Sql> = {
    name: Prisma.sql`lower(coalesce(c.full_name, concat_ws(' ', c.first_name, c.last_name), c.email))`,
    company: Prisma.sql`lower(coalesce(co.name, ''))`,
    phone: Prisma.sql`lower(coalesce(c.phone, ''))`,
    email: Prisma.sql`lower(c.email)`,
    role: Prisma.sql`lower(coalesce(c.title, ''))`,
    status: Prisma.sql`c.status`,
    relatedLeads: Prisma.sql`related.related_leads_count`,
    lastActivity: Prisma.sql`activity.last_activity_at`,
    createdAt: Prisma.sql`c.created_at`,
    updatedAt: Prisma.sql`c.updated_at`,
  };
  const column = sortMap[sort ?? "updatedAt"] ?? sortMap.updatedAt;
  return Prisma.sql`${column} ${direction} NULLS LAST, c.updated_at DESC`;
}

function contactWhereClause(input: { search: string; status: string; source: string; company: string }) {
  const searchPattern = `%${input.search}%`;
  const companyPattern = `%${input.company}%`;
  return Prisma.sql`
    (${input.search} = '' OR c.email ILIKE ${searchPattern} OR c.phone ILIKE ${searchPattern} OR c.full_name ILIKE ${searchPattern} OR c.first_name ILIKE ${searchPattern} OR c.last_name ILIKE ${searchPattern} OR c.title ILIKE ${searchPattern} OR c.notes ILIKE ${searchPattern} OR co.name ILIKE ${searchPattern})
      AND (${input.status} = '' OR c.status = ${input.status})
      AND (${input.source} = '' OR c.source = ${input.source})
      AND (${input.company} = '' OR co.name ILIKE ${companyPattern})
  `;
}

export async function listContacts(filters: ContactListFilters = {}) {
  const search = trim(filters.search) ?? "";
  const status = trim(filters.status) ?? "";
  const source = trim(filters.source) ?? "";
  const company = trim(filters.company) ?? "";
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
  const offset = Math.max(filters.offset ?? 0, 0);
  const where = contactWhereClause({ search, status, source, company });
  const orderBy = contactSortClause(filters.sort, filters.dir);

  return getPrisma().$queryRaw<ContactRecord[]>`
    SELECT c.id::text, c.first_name, c.last_name, c.full_name, c.email, c.phone, c.title, c.source, c.status,
      c.consent_status, c.company_id::text, co.name AS company_name, co.status AS company_status, co.company_type,
      c.notes, related.related_leads_count::int, activity.last_activity_at, c.created_at, c.updated_at
    FROM email_contacts c
    LEFT JOIN email_companies co ON co.id = c.company_id
    LEFT JOIN LATERAL (
      SELECT count(*) AS related_leads_count
      FROM leads l
      WHERE l.contact_id = c.id AND l.archived_at IS NULL
    ) related ON true
    LEFT JOIN LATERAL (
      SELECT max(e.created_at) AS last_activity_at
      FROM email_events e
      WHERE e.contact_id = c.id
    ) activity ON true
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ${limit}
    OFFSET ${offset}
  `;
}

export async function countContacts(filters: ContactListFilters = {}) {
  const search = trim(filters.search) ?? "";
  const status = trim(filters.status) ?? "";
  const source = trim(filters.source) ?? "";
  const company = trim(filters.company) ?? "";
  const where = contactWhereClause({ search, status, source, company });
  const [row] = await getPrisma().$queryRaw<Array<{ total: bigint }>>`
    SELECT count(*) AS total
    FROM email_contacts c
    LEFT JOIN email_companies co ON co.id = c.company_id
    WHERE ${where}
  `;
  return Number(row?.total ?? 0);
}

export async function getContactDetail(id: string) {
  const [contact] = await getPrisma().$queryRaw<ContactRecord[]>`
    SELECT c.id::text, c.first_name, c.last_name, c.full_name, c.email, c.phone, c.title, c.source, c.status,
      c.consent_status, c.company_id::text, co.name AS company_name, co.status AS company_status, co.company_type,
      c.notes, related.related_leads_count::int, activity.last_activity_at, c.created_at, c.updated_at
    FROM email_contacts c
    LEFT JOIN email_companies co ON co.id = c.company_id
    LEFT JOIN LATERAL (
      SELECT count(*) AS related_leads_count
      FROM leads l
      WHERE l.contact_id = c.id AND l.archived_at IS NULL
    ) related ON true
    LEFT JOIN LATERAL (
      SELECT max(e.created_at) AS last_activity_at
      FROM email_events e
      WHERE e.contact_id = c.id
    ) activity ON true
    WHERE c.id = ${id}::uuid
    LIMIT 1
  `;
  if (!contact) return null;
  const relatedLeads = await getPrisma().$queryRaw<ContactLeadSummary[]>`
    SELECT id::text, nullif(concat_ws(' ', first_name, last_name), '') AS name, status, source, estimated_value::text, updated_at
    FROM leads
    WHERE contact_id = ${id}::uuid AND archived_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 10
  `;
  return { contact, relatedLeads };
}
