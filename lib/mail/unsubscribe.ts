import crypto from "node:crypto";
import { writeAuditEvent } from "@/lib/audit";
import { getPrisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/mail/render-template";

function secret() {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("Missing required env var: AUTH_SECRET");
  return value;
}

export function signUnsubscribeEmail(email: string) {
  return crypto.createHmac("sha256", secret()).update(normalizeEmail(email)).digest("hex");
}

export function verifyUnsubscribeToken(email: string, token: string) {
  const expected = signUnsubscribeEmail(email);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(token, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function buildUnsubscribeUrl(email: string) {
  const base = process.env.EMAIL_TRACKING_BASE_URL || process.env.APP_BASE_URL;
  if (!base) return null;
  const normalized = normalizeEmail(email);
  const url = new URL("/api/email-engine/unsubscribe", base);
  url.searchParams.set("email", normalized);
  url.searchParams.set("token", signUnsubscribeEmail(normalized));
  return url.toString();
}

export async function suppressByUnsubscribe(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("email is required");
  await getPrisma().$executeRaw`
    INSERT INTO email_suppressions (email, reason, source)
    VALUES (${normalized}, 'unsubscribed', 'unsubscribe_link')
    ON CONFLICT (email) DO UPDATE SET reason = 'unsubscribed', source = 'unsubscribe_link'
  `;
  await getPrisma().$executeRaw`
    UPDATE email_contacts SET status = 'unsubscribed', updated_at = now() WHERE email = ${normalized}
  `;
  await getPrisma().$executeRaw`
    INSERT INTO email_events (event_type, metadata)
    VALUES ('unsubscribed', ${JSON.stringify({ email: normalized, source: "unsubscribe_link" })}::jsonb)
  `;
  await writeAuditEvent({ actor: null, entityType: "email_suppression", action: "unsubscribe", metadata: { email: normalized } });
}
