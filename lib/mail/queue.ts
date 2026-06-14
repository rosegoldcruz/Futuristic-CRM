import type { Prisma } from "@prisma/client";
import type { AppUser } from "@/lib/auth/access";
import { writeAuditEvent } from "@/lib/audit";
import { getPrisma } from "@/lib/prisma";
import { ensureSendSettings } from "@/lib/mail/data";
import { normalizeEmail } from "@/lib/mail/render-template";
import { sendEmail } from "@/lib/mail/smtp";
import { buildUnsubscribeUrl } from "@/lib/mail/unsubscribe";

const UNSENDABLE_CONTACT_STATUSES = new Set(["bounced", "unsubscribed", "do_not_contact", "archived"]);
const MAX_PROCESS_BATCH = 25;

type QueueJob = {
  id: string;
  campaign_id: string | null;
  lead_id: string | null;
  contact_id: string | null;
  recipient_id: string | null;
  recipient_email: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  attempt_count: number;
  max_attempts: number;
};

type QueueEventInput = {
  queueId?: string | null;
  campaignId?: string | null;
  recipientId?: string | null;
  contactId?: string | null;
  eventType: string;
  metadata?: Prisma.InputJsonValue;
};

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  return message.slice(0, 800);
}

function envInt(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function warmupCap(now = new Date()) {
  const override = envInt("EMAIL_DAILY_CAP_OVERRIDE", 0);
  if (override > 0) return override;

  const startRaw = process.env.EMAIL_WARMUP_START_DATE?.trim();
  const start = startRaw ? new Date(startRaw) : null;
  if (!start || Number.isNaN(start.getTime())) return 25;

  const ageDays = Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1;
  if (ageDays <= 2) return 25;
  if (ageDays <= 4) return 50;
  if (ageDays <= 7) return 75;
  if (ageDays <= 14) return 100;
  if (ageDays <= 21) return 150;
  return 200;
}

async function logQueueEvent(input: QueueEventInput) {
  await getPrisma().$executeRaw`
    INSERT INTO email_events (campaign_id, queue_id, recipient_id, contact_id, event_type, metadata)
    VALUES (${input.campaignId ?? null}::uuid, ${input.queueId ?? null}::uuid, ${input.recipientId ?? null}::uuid, ${input.contactId ?? null}::uuid, ${input.eventType}, ${input.metadata ?? {}})
  `;
}

export async function getSendGuardStats() {
  const settings = await ensureSendSettings();
  const [stats] = await getPrisma().$queryRaw<
    Array<{ sent_today: bigint; queued: bigint; sending: bigint; failed: bigint; suppressed: bigint; last_sent_at: Date | null }>
  >`
    SELECT
      (SELECT count(*) FROM email_events WHERE event_type = 'sent' AND created_at >= current_date) AS sent_today,
      (SELECT count(*) FROM email_queue WHERE status = 'queued') AS queued,
      (SELECT count(*) FROM email_queue WHERE status = 'sending') AS sending,
      (SELECT count(*) FROM email_queue WHERE status = 'failed') AS failed,
      (SELECT count(*) FROM email_suppressions) AS suppressed,
      (SELECT max(created_at) FROM email_events WHERE event_type = 'sent') AS last_sent_at
  `;
  const warmup = warmupCap();
  const effectiveDailyCap = Math.min(settings.daily_limit, warmup);
  return {
    settings,
    warmupCap: warmup,
    effectiveDailyCap,
    sentToday: Number(stats?.sent_today ?? 0),
    queued: Number(stats?.queued ?? 0),
    sending: Number(stats?.sending ?? 0),
    failed: Number(stats?.failed ?? 0),
    suppressed: Number(stats?.suppressed ?? 0),
    lastSentAt: stats?.last_sent_at ?? null,
  };
}

async function canSendTo(email: string, contactId?: string | null) {
  const normalized = normalizeEmail(email);
  if (!normalized) return "recipient email is required";

  const [row] = await getPrisma().$queryRaw<Array<{ suppression_reason: string | null; contact_status: string | null }>>`
    SELECT s.reason AS suppression_reason, c.status AS contact_status
    FROM (SELECT ${normalized}::text AS email) target
    LEFT JOIN email_suppressions s ON s.email = target.email
    LEFT JOIN email_contacts c ON c.email = target.email OR (${contactId ?? null}::uuid IS NOT NULL AND c.id = ${contactId ?? null}::uuid)
    LIMIT 1
  `;

  if (row?.suppression_reason) return `Email suppressed: ${row.suppression_reason}`;
  if (row?.contact_status && UNSENDABLE_CONTACT_STATUSES.has(row.contact_status)) return `Contact status is ${row.contact_status}`;
  return null;
}

async function claimDueJobs(limit: number) {
  return getPrisma().$transaction(async (tx) => {
    return tx.$queryRaw<QueueJob[]>`
      UPDATE email_queue q
      SET status = 'sending',
        attempt_count = q.attempt_count + 1,
        provider = coalesce(q.provider, 'smtp'),
        updated_at = now()
      WHERE q.id IN (
        SELECT id
        FROM email_queue
        WHERE status IN ('queued', 'failed')
          AND attempt_count < max_attempts
          AND coalesce(next_attempt_at, created_at) <= now()
        ORDER BY coalesce(next_attempt_at, created_at), created_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id::text, campaign_id::text, lead_id::text, contact_id::text, recipient_id::text, recipient_email, subject, body_html, body_text, attempt_count, max_attempts
    `;
  });
}

async function markSuppressed(job: QueueJob, reason: string) {
  await getPrisma().$executeRaw`
    UPDATE email_queue
    SET status = 'suppressed', last_error = ${reason}, updated_at = now()
    WHERE id = ${job.id}::uuid
  `;
  if (job.recipient_id) {
    await getPrisma().$executeRaw`
      UPDATE email_campaign_recipients
      SET status = 'suppressed', last_error = ${reason}, updated_at = now()
      WHERE id = ${job.recipient_id}::uuid
    `;
  }
  await logQueueEvent({
    queueId: job.id,
    campaignId: job.campaign_id,
    recipientId: job.recipient_id,
    contactId: job.contact_id,
    eventType: "suppressed",
    metadata: { reason },
  });
}

async function markFailed(job: QueueJob, error: string) {
  const terminal = job.attempt_count >= job.max_attempts;
  await getPrisma().$executeRaw`
    UPDATE email_queue
    SET status = 'failed',
      last_error = ${error},
      next_attempt_at = CASE WHEN ${terminal} THEN NULL ELSE now() + (${Math.min(job.attempt_count * 5, 30)} || ' minutes')::interval END,
      updated_at = now()
    WHERE id = ${job.id}::uuid
  `;
  if (job.recipient_id) {
    await getPrisma().$executeRaw`
      UPDATE email_campaign_recipients
      SET status = 'send_failed', last_error = ${error}, updated_at = now()
      WHERE id = ${job.recipient_id}::uuid
    `;
  }
  await logQueueEvent({
    queueId: job.id,
    campaignId: job.campaign_id,
    recipientId: job.recipient_id,
    contactId: job.contact_id,
    eventType: "failed",
    metadata: { error, terminal },
  });
}

async function markSent(job: QueueJob, messageId: string | null, response: string | null, dryRun: boolean) {
  await getPrisma().$executeRaw`
    UPDATE email_queue
    SET status = 'sent',
      provider_message_id = ${messageId},
      sent_at = now(),
      last_error = NULL,
      updated_at = now()
    WHERE id = ${job.id}::uuid
  `;
  if (job.recipient_id) {
    await getPrisma().$executeRaw`
      UPDATE email_campaign_recipients
      SET status = 'sent', sent_at = now(), provider_message_id = ${messageId}, last_error = NULL, updated_at = now()
      WHERE id = ${job.recipient_id}::uuid
    `;
  }
  await logQueueEvent({
    queueId: job.id,
    campaignId: job.campaign_id,
    recipientId: job.recipient_id,
    contactId: job.contact_id,
    eventType: "sent",
    metadata: { messageId, response, dryRun },
  });
}

export async function queueSingleEmail(input: {
  to: string;
  subject: string;
  html?: string | null;
  text?: string | null;
  campaignId?: string | null;
  leadId?: string | null;
  contactId?: string | null;
  recipientId?: string | null;
  scheduledAt?: Date | null;
}) {
  const email = normalizeEmail(input.to);
  if (!email) throw new Error("to is required");
  const blocked = await canSendTo(email, input.contactId);
  if (blocked) {
    await logQueueEvent({
      campaignId: input.campaignId,
      recipientId: input.recipientId,
      contactId: input.contactId,
      eventType: "suppressed",
      metadata: { to: email, reason: blocked },
    });
    return { queued: false, suppressed: true, reason: blocked };
  }
  const unsubscribeUrl = input.campaignId ? buildUnsubscribeUrl(email) : null;
  const html = unsubscribeUrl
    ? `${input.html ?? input.text ?? ""}<p style="font-size:12px;color:#667085;margin-top:24px">To stop receiving campaign emails, <a href="${unsubscribeUrl}">unsubscribe here</a>.</p>`
    : input.html ?? input.text ?? "";
  const text = unsubscribeUrl
    ? `${input.text ?? ""}\n\nUnsubscribe: ${unsubscribeUrl}`.trim()
    : input.text ?? null;

  const [queue] = await getPrisma().$queryRaw<Array<{ id: string }>>`
    INSERT INTO email_queue (campaign_id, lead_id, contact_id, recipient_id, recipient_email, subject, body_html, body_text, status, next_attempt_at)
    SELECT ${input.campaignId ?? null}::uuid, ${input.leadId ?? null}::uuid, ${input.contactId ?? null}::uuid, ${input.recipientId ?? null}::uuid, ${email}, ${input.subject}, ${html}, ${text}, 'queued', ${input.scheduledAt ?? null}::timestamptz
    WHERE NOT EXISTS (
      SELECT 1 FROM email_queue
      WHERE (${input.campaignId ?? null}::uuid IS NOT NULL AND campaign_id = ${input.campaignId ?? null}::uuid AND recipient_email = ${email})
        OR (${input.recipientId ?? null}::uuid IS NOT NULL AND recipient_id = ${input.recipientId ?? null}::uuid)
    )
    RETURNING id::text
  `;

  if (!queue) return { queued: false, duplicate: true };
  await logQueueEvent({
    queueId: queue.id,
    campaignId: input.campaignId,
    recipientId: input.recipientId,
    contactId: input.contactId,
    eventType: "queued",
    metadata: { to: email, subject: input.subject },
  });
  return { queued: true, id: queue.id };
}

export async function enqueueManualCampaign(input: {
  name: string;
  source: "contacts" | "leads" | "both";
  contactIds?: string[];
  leadIds?: string[];
  subject: string;
  html?: string | null;
  text?: string | null;
}, actor: AppUser) {
  const name = input.name.trim();
  const subject = input.subject.trim();
  if (!name) throw new Error("name is required");
  if (!subject) throw new Error("subject is required");
  if (!input.html?.trim() && !input.text?.trim()) throw new Error("body is required");

  const [campaign] = await getPrisma().$queryRaw<Array<{ id: string }>>`
    INSERT INTO email_campaigns (name, subject_override, status)
    VALUES (${name}, ${subject}, 'queued')
    RETURNING id::text
  `;

  const contactIds = input.contactIds?.filter(Boolean) ?? [];
  const leadIds = input.leadIds?.filter(Boolean) ?? [];
  const includeContacts = input.source === "contacts" || input.source === "both";
  const includeLeads = input.source === "leads" || input.source === "both";

  const contacts = includeContacts
    ? await getPrisma().$queryRaw<Array<{ contact_id: string | null; lead_id: string | null; email: string | null; status: string | null }>>`
        SELECT id::text AS contact_id, NULL::text AS lead_id, email, status
        FROM email_contacts
        WHERE (${contactIds.length} = 0 OR id::text = ANY(${contactIds}))
        ORDER BY updated_at DESC
        LIMIT 1000
      `
    : [];
  const leads = includeLeads
    ? await getPrisma().$queryRaw<Array<{ contact_id: string | null; lead_id: string | null; email: string | null; status: string | null }>>`
        SELECT contact_id::text, id::text AS lead_id, email, NULL::text AS status
        FROM leads
        WHERE archived_at IS NULL
          AND (${leadIds.length} = 0 OR id::text = ANY(${leadIds}))
        ORDER BY updated_at DESC
        LIMIT 1000
      `
    : [];

  const seen = new Set<string>();
  const counts = { selected: contacts.length + leads.length, queued: 0, skipped_missing_email: 0, skipped_suppressed: 0, skipped_duplicate: 0, errors: 0 };

  for (const row of [...contacts, ...leads]) {
    const email = normalizeEmail(row.email);
    if (!email) {
      counts.skipped_missing_email += 1;
      continue;
    }
    if (seen.has(email)) {
      counts.skipped_duplicate += 1;
      continue;
    }
    seen.add(email);
    if (row.status && UNSENDABLE_CONTACT_STATUSES.has(row.status)) {
      counts.skipped_suppressed += 1;
      continue;
    }
    try {
      const result = await queueSingleEmail({
        to: email,
        subject,
        html: input.html,
        text: input.text,
        campaignId: campaign.id,
        contactId: row.contact_id,
        leadId: row.lead_id,
      });
      if (result.queued) counts.queued += 1;
      else if (result.suppressed) counts.skipped_suppressed += 1;
      else if (result.duplicate) counts.skipped_duplicate += 1;
    } catch {
      counts.errors += 1;
    }
  }

  await writeAuditEvent({ actor, entityType: "email_campaign", entityId: campaign.id, action: "manual_enqueue", metadata: counts });
  return { campaignId: campaign.id, ...counts };
}

export async function processEmailQueue(actor?: AppUser | null) {
  const guards = await getSendGuardStats();
  if (!guards.settings.enabled) return { ok: false, message: "Sending disabled in /mail/settings", processed: 0, sent: 0, failed: 0, suppressed: 0 };

  const remainingDaily = Math.max(0, guards.effectiveDailyCap - guards.sentToday);
  if (remainingDaily <= 0) return { ok: false, message: "Daily send limit reached", processed: 0, sent: 0, failed: 0, suppressed: 0 };

  if (guards.lastSentAt) {
    const secondsSinceLastSend = (Date.now() - guards.lastSentAt.getTime()) / 1000;
    if (secondsSinceLastSend < guards.settings.min_seconds_between_sends) {
      return { ok: false, message: `Throttle active. Next send allowed in ${Math.ceil(guards.settings.min_seconds_between_sends - secondsSinceLastSend)}s`, processed: 0, sent: 0, failed: 0, suppressed: 0 };
    }
  }

  const batchLimit = Math.min(guards.settings.batch_size || 10, remainingDaily, MAX_PROCESS_BATCH);
  const jobs = await claimDueJobs(batchLimit);
  let sent = 0;
  let failed = 0;
  let suppressed = 0;

  for (const job of jobs) {
    const blocked = await canSendTo(job.recipient_email, job.contact_id);
    if (blocked) {
      suppressed += 1;
      await markSuppressed(job, blocked);
      continue;
    }

    await logQueueEvent({
      queueId: job.id,
      campaignId: job.campaign_id,
      recipientId: job.recipient_id,
      contactId: job.contact_id,
      eventType: "send_attempt",
      metadata: { to: job.recipient_email, attempt: job.attempt_count },
    });

    const result = await sendEmail({
      to: job.recipient_email,
      subject: job.subject,
      html: job.body_html,
      text: job.body_text ?? undefined,
    });

    if (result.ok) {
      sent += 1;
      await markSent(job, result.messageId ?? null, result.response ?? null, Boolean(result.dryRun));
    } else {
      failed += 1;
      await markFailed(job, result.error ?? "Send failed");
    }
  }

  await writeAuditEvent({
    actor,
    entityType: "email_queue",
    action: "process",
    metadata: { processed: jobs.length, sent, failed, suppressed, effectiveDailyCap: guards.effectiveDailyCap },
  });

  return { ok: true, message: `Processed ${jobs.length}. Sent ${sent}. Failed ${failed}. Suppressed ${suppressed}.`, processed: jobs.length, sent, failed, suppressed };
}
