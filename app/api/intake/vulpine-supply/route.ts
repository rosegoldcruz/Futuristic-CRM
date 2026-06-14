import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

type IntakePayload = {
  fullName?: unknown;
  email?: unknown;
  phone?: unknown;
  company?: unknown;
  roleType?: unknown;
  projectType?: unknown;
  productsNeeded?: unknown;
  projectSize?: unknown;
  projectLocation?: unknown;
  bidDueDate?: unknown;
  planLink?: unknown;
  message?: unknown;
  projectDetails?: unknown;
  sourcePage?: unknown;
  source?: unknown;
  submittedAt?: unknown;
  userAgent?: unknown;
  referer?: unknown;
  syncStatus?: unknown;
};

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseBearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function toIsoOrNull(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export async function POST(request: Request) {
  try {
    const configuredToken = process.env.VULPINE_SUPPLY_INTAKE_TOKEN?.trim();
    const receivedToken = parseBearerToken(request.headers.get("authorization"));

    if (!configuredToken || !receivedToken || receivedToken !== configuredToken) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as IntakePayload;
    const fullName = asText(body.fullName);
    const email = asText(body.email)?.toLowerCase() ?? null;
    const phone = asText(body.phone);
    const projectType = asText(body.projectType);
    const message = asText(body.message) ?? asText(body.projectDetails);

    if (!fullName) {
      return NextResponse.json({ ok: false, error: "fullName is required" }, { status: 400 });
    }
    if (!email && !phone) {
      return NextResponse.json({ ok: false, error: "email or phone is required" }, { status: 400 });
    }
    if (!projectType) {
      return NextResponse.json({ ok: false, error: "projectType is required" }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ ok: false, error: "message or projectDetails is required" }, { status: 400 });
    }

    const { firstName, lastName } = splitName(fullName);
    const sourcePage = asText(body.sourcePage);
    const source = "vulpine-supply";
    const companyName = asText(body.company);
    const roleType = asText(body.roleType);
    const productsNeeded = asText(body.productsNeeded);
    const projectSize = asText(body.projectSize);
    const projectLocation = asText(body.projectLocation);
    const bidDueDate = asText(body.bidDueDate);
    const planLink = asText(body.planLink);
    const submittedAt = asText(body.submittedAt);
    const userAgent = asText(body.userAgent) ?? asText(request.headers.get("user-agent"));
    const referer = asText(body.referer) ?? asText(request.headers.get("referer"));
    const syncStatus = asText(body.syncStatus);

    const notes = [
      message,
      "",
      `projectType: ${projectType}`,
      `roleType: ${roleType ?? ""}`,
      `productsNeeded: ${productsNeeded ?? ""}`,
      `projectSize: ${projectSize ?? ""}`,
      `projectLocation: ${projectLocation ?? ""}`,
      `bidDueDate: ${bidDueDate ?? ""}`,
      `planLink: ${planLink ?? ""}`,
      `sourcePage: ${sourcePage ?? ""}`,
      `submittedAt: ${submittedAt ?? ""}`,
      `syncStatus: ${syncStatus ?? ""}`,
    ].join("\n");

    const [lead] = await getPrisma().$queryRaw<Array<{ id: string }>>`
      INSERT INTO leads (
        first_name,
        last_name,
        email,
        phone,
        company_name,
        source,
        campaign,
        status,
        interest_level,
        notes
      )
      VALUES (
        ${firstName},
        ${lastName},
        ${email},
        ${phone},
        ${companyName},
        ${source},
        ${projectType},
        ${"new"},
        ${"unknown"},
        ${notes}
      )
      RETURNING id::text
    `;

    await getPrisma().$executeRaw`
      INSERT INTO lead_events (lead_id, event_type, metadata)
      VALUES (
        ${lead.id}::uuid,
        ${"intake.vulpine_supply"},
        ${
          {
            source,
            sourcePage,
            submittedAt: toIsoOrNull(submittedAt),
            receivedAt: new Date().toISOString(),
            syncStatus,
            userAgent,
            referer,
            projectType,
            roleType,
            productsNeeded,
            projectSize,
            projectLocation,
            bidDueDate: toIsoOrNull(bidDueDate),
            planLink,
            payload: body,
          } as const
        }
      )
    `;

    return NextResponse.json({ ok: true, id: lead.id });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request payload" }, { status: 400 });
  }
}