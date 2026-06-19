import { NextRequest, NextResponse } from "next/server";
import { suppressByBounce, suppressByUnsubscribe } from "@/lib/mail/unsubscribe";
import { normalizeEmail } from "@/lib/mail/render-template";

// Supported event types that trigger suppression.
const SUPPRESSION_EVENTS = new Set([
  "bounce",
  "bounced",
  "complaint",
  "spamreport",
  "spam_complaint",
  "unsubscribe",
  "unsubscribed",
  "group_unsubscribe",
]);

function getBearerToken(request: NextRequest): string {
  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return request.headers.get("x-email-webhook-secret") ?? "";
}

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a.padEnd(64));
  const bBytes = encoder.encode(b.padEnd(64));
  // constant-time comparison
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < Math.min(aBytes.length, bBytes.length); i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0 && a.length === b.length;
}

type EventRecord = {
  email: string | null;
  eventType: string;
  provider: string;
  raw: unknown;
};

function parseProviderPayload(provider: string, body: unknown): EventRecord[] {
  const records: EventRecord[] = [];

  if (provider === "sendgrid") {
    // SendGrid delivers an array of event objects.
    const events = Array.isArray(body) ? body : [];
    for (const ev of events) {
      if (typeof ev !== "object" || ev === null) continue;
      const e = ev as Record<string, unknown>;
      records.push({
        email: typeof e.email === "string" ? e.email : null,
        eventType: typeof e.event === "string" ? e.event : "",
        provider: "sendgrid",
        raw: ev,
      });
    }
  } else if (provider === "postmark") {
    // Postmark delivers a single event object.
    if (typeof body === "object" && body !== null) {
      const e = body as Record<string, unknown>;
      const email = typeof e.Email === "string" ? e.Email
        : typeof e.Recipient === "string" ? e.Recipient
        : null;
      const eventType = typeof e.RecordType === "string"
        ? e.RecordType.toLowerCase()
        : "";
      records.push({ email, eventType, provider: "postmark", raw: body });
    }
  } else if (provider === "mailgun") {
    // Mailgun delivers { "event-data": { ... } }.
    if (typeof body === "object" && body !== null) {
      const b = body as Record<string, unknown>;
      const eventData = (b["event-data"] ?? b) as Record<string, unknown>;
      const email = typeof eventData.recipient === "string" ? eventData.recipient
        : typeof eventData.email === "string" ? eventData.email
        : null;
      const eventType = typeof eventData.event === "string" ? eventData.event : "";
      records.push({ email, eventType, provider: "mailgun", raw: eventData });
    }
  } else {
    // Unknown provider: attempt a generic parse if body is an array or single object.
    const items = Array.isArray(body) ? body : [body];
    for (const item of items) {
      if (typeof item !== "object" || item === null) continue;
      const e = item as Record<string, unknown>;
      const email = typeof e.email === "string" ? e.email
        : typeof e.Email === "string" ? e.Email
        : typeof e.recipient === "string" ? e.recipient
        : null;
      const eventType = typeof e.event === "string" ? e.event
        : typeof e.type === "string" ? e.type
        : "";
      records.push({ email, eventType, provider: "unknown", raw: item });
    }
  }

  return records;
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET?.trim() ?? "";
  if (!webhookSecret) {
    return NextResponse.json(
      { ok: false, error: "Missing required env var: EMAIL_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  const supplied = getBearerToken(request);
  if (!supplied || !timingSafeEqual(supplied, webhookSecret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const provider = (request.nextUrl.searchParams.get("provider") ?? "unknown").toLowerCase();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const records = parseProviderPayload(provider, body);
  let processed = 0;
  let skipped = 0;

  for (const record of records) {
    const email = normalizeEmail(record.email);
    if (!email) {
      skipped += 1;
      continue;
    }

    const eventType = record.eventType.toLowerCase();
    if (!SUPPRESSION_EVENTS.has(eventType)) {
      // Non-suppression event (e.g. open, click) — skip silently.
      skipped += 1;
      continue;
    }

    try {
      if (eventType === "unsubscribe" || eventType === "unsubscribed" || eventType === "group_unsubscribe") {
        await suppressByUnsubscribe(email);
      } else {
        const reason = (eventType === "complaint" || eventType === "spamreport" || eventType === "spam_complaint")
          ? "complaint" as const
          : "bounce" as const;
        await suppressByBounce(email, reason, `${provider}_webhook`);
      }
      processed += 1;
    } catch {
      // Do not throw on individual record failures — count as skipped.
      skipped += 1;
    }
  }

  return NextResponse.json({ ok: true, processed, skipped });
}
