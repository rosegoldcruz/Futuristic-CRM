import { NextResponse } from "next/server";
import { canAccessAdmin, getCurrentAppUser } from "@/lib/auth/access";
import { processEmailQueue } from "@/lib/mail/queue";

export async function POST() {
  const actor = await getCurrentAppUser();
  if (!actor || actor.status !== "ACTIVE") return NextResponse.json({ ok: false, message: "Authentication required" }, { status: 401 });
  if (!canAccessAdmin(actor.role)) return NextResponse.json({ ok: false, message: "Admin role required" }, { status: 403 });
  const result = await processEmailQueue(actor);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
