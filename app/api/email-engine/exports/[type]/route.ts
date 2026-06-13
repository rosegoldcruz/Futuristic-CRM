import { NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth/access";
import { writeAuditEvent } from "@/lib/audit";
import { getPrisma } from "@/lib/prisma";

function csvEscape(value: unknown) {
  const text = value instanceof Date ? value.toISOString() : String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
}

export async function GET(_request: Request, { params }: { params: { type: string } }) {
  try {
    const actor = await getCurrentUserOrThrow();
    let rows: Array<Record<string, unknown>>;

    if (params.type === "contacts") {
      rows = await getPrisma().$queryRaw<Array<Record<string, unknown>>>`
        SELECT c.email, c.first_name, c.last_name, c.full_name, c.title, c.phone, c.status, c.consent_status, co.name AS company_name, c.source, c.created_at, c.updated_at
        FROM email_contacts c
        LEFT JOIN email_companies co ON co.id = c.company_id
        ORDER BY c.created_at DESC
      `;
    } else if (params.type === "companies") {
      rows = await getPrisma().$queryRaw<Array<Record<string, unknown>>>`
        SELECT name, domain, website, industry, source, status, notes, created_at, updated_at
        FROM email_companies
        ORDER BY name
      `;
    } else if (params.type === "suppressions") {
      rows = await getPrisma().$queryRaw<Array<Record<string, unknown>>>`
        SELECT email, reason, source, created_at
        FROM email_suppressions
        ORDER BY created_at DESC
      `;
    } else if (params.type === "campaign-events") {
      rows = await getPrisma().$queryRaw<Array<Record<string, unknown>>>`
        SELECT e.event_type, ca.name AS campaign_name, c.email AS contact_email, e.metadata::text AS metadata, e.created_at
        FROM email_events e
        LEFT JOIN email_campaigns ca ON ca.id = e.campaign_id
        LEFT JOIN email_contacts c ON c.id = e.contact_id
        ORDER BY e.created_at DESC
      `;
    } else {
      return NextResponse.json({ ok: false, error: "Unsupported export type" }, { status: 404 });
    }

    await writeAuditEvent({
      actor,
      entityType: "email_export",
      action: "download",
      metadata: { type: params.type, rows: rows.length },
    });

    const csv = toCsv(rows);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${params.type}.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
