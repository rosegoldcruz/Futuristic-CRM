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

    if (params.type === "leads") {
      rows = await getPrisma().$queryRaw<Array<Record<string, unknown>>>`
        SELECT first_name, last_name, email, phone, company_name, title, source, campaign, status, interest_level,
          assigned_to, estimated_value::text AS estimated_value, last_contacted_at, next_follow_up_at, notes,
          company_id::text AS company_id, contact_id::text AS contact_id, created_at, updated_at
        FROM leads
        WHERE archived_at IS NULL
        ORDER BY created_at DESC
      `;
    } else if (params.type === "events") {
      rows = await getPrisma().$queryRaw<Array<Record<string, unknown>>>`
        SELECT e.lead_id::text AS lead_id, l.email, l.company_name, e.event_type, e.metadata::text AS metadata, e.created_at
        FROM lead_events e
        JOIN leads l ON l.id = e.lead_id
        ORDER BY e.created_at DESC
      `;
    } else {
      return NextResponse.json({ ok: false, error: "Unsupported export type" }, { status: 404 });
    }

    await writeAuditEvent({ actor, entityType: "lead_export", action: "download", metadata: { type: params.type, rows: rows.length } });

    return new Response(toCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="lead-${params.type}.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
