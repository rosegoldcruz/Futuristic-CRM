import type { Prisma } from "@prisma/client";
import type { AppUser } from "@/lib/auth/access";
import { writeAuditEvent } from "@/lib/audit";
import { getPrisma } from "@/lib/prisma";

export async function createAutomationRun(input: {
  source: string;
  action: string;
  payload?: Prisma.InputJsonValue;
  actor?: AppUser;
}) {
  const [run] = await getPrisma().$queryRaw<Array<{ id: string }>>`
    INSERT INTO automation_runs (source, action, status, input)
    VALUES (${input.source}, ${input.action}, 'pending', ${input.payload ?? {}})
    RETURNING id::text
  `;
  await writeAuditEvent({
    actor: input.actor,
    entityType: "automation_run",
    entityId: run.id,
    action: "create",
    metadata: { source: input.source, action: input.action },
  });
  return run;
}

export async function updateAutomationRun(
  id: string,
  input: {
    status: string;
    output?: Prisma.InputJsonValue;
    error?: string | null;
    actor?: AppUser;
  }
) {
  await getPrisma().$executeRaw`
    UPDATE automation_runs
    SET status = ${input.status},
      output = ${input.output ?? null},
      error = ${input.error ?? null},
      updated_at = now()
    WHERE id = ${id}::uuid
  `;
  await writeAuditEvent({
    actor: input.actor,
    entityType: "automation_run",
    entityId: id,
    action: "update",
    metadata: { status: input.status },
  });
  return { id };
}

export async function triggerN8nWebhook(input: {
  path: string;
  payload: Prisma.InputJsonValue;
  actor: AppUser;
}) {
  const baseUrl = process.env.N8N_WEBHOOK_BASE_URL || process.env.N8N_WEBHOOK_URL;
  if (!baseUrl) throw new Error("Missing required env var: N8N_WEBHOOK_URL");

  const run = await createAutomationRun({
    source: "n8n",
    action: input.path,
    payload: input.payload,
    actor: input.actor,
  });

  try {
    const url = new URL(input.path.replace(/^\/+/, ""), `${baseUrl.replace(/\/+$/, "")}/`);
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: run.id, payload: input.payload }),
    });
    const text = await response.text();
    await updateAutomationRun(run.id, {
      status: response.ok ? "sent" : "failed",
      output: { status: response.status, body: text },
      error: response.ok ? null : text,
      actor: input.actor,
    });
    return { runId: run.id, status: response.status, ok: response.ok };
  } catch (error) {
    const message = error instanceof Error ? error.message : "n8n webhook failed";
    await updateAutomationRun(run.id, { status: "failed", error: message, actor: input.actor });
    throw error;
  }
}
