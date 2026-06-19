import { NextRequest, NextResponse } from "next/server";
import { processEmailQueue } from "@/lib/mail/queue";

// Intended cron usage (run as root or with appropriate env):
//   */5 * * * * curl -sS -X GET -H "Authorization: Bearer $EMAIL_CRON_SECRET" https://crm.vulpinehomes.com/api/email-engine/cron
//
// This endpoint does NOT bypass any send guards:
//   - EMAIL_DRY_RUN=true is respected (no real SMTP calls).
//   - email_send_settings.enabled=false is respected (processEmailQueue returns early).
//   - Daily cap and throttle limits are respected.
//   - Suppression checks run per job.

function getBearerToken(request: NextRequest): string {
  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return "";
}

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a.padEnd(128));
  const bBytes = encoder.encode(b.padEnd(128));
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < Math.min(aBytes.length, bBytes.length); i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0 && a.length === b.length;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.EMAIL_CRON_SECRET?.trim() ?? "";
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "Missing required env var: EMAIL_CRON_SECRET" },
      { status: 500 }
    );
  }

  const supplied = getBearerToken(request);
  if (!supplied || !timingSafeEqual(supplied, cronSecret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await processEmailQueue(null);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
