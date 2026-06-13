import type { Prisma } from "@prisma/client";
import type { AppUser } from "@/lib/auth/access";
import { getPrisma } from "@/lib/prisma";

export type AuditActor = Pick<AppUser, "id" | "email"> | null | undefined;

export async function writeAuditEvent(input: {
  actor?: AuditActor;
  entityType: string;
  entityId?: string | null;
  action: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await getPrisma().$executeRaw`
    INSERT INTO audit_events (actor_user_id, actor_email, entity_type, entity_id, action, metadata)
    VALUES (
      ${input.actor?.id ?? null},
      ${input.actor?.email ?? null},
      ${input.entityType},
      ${input.entityId ?? null},
      ${input.action},
      ${input.metadata ?? {}}
    )
  `;
}
