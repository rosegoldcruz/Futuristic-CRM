import { NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth/access";
import { executeRegisteredCommand, registeredCommandActions } from "@/lib/command";

export async function GET() {
  await getCurrentUserOrThrow();
  return NextResponse.json({
    actions: Object.fromEntries(
      Object.entries(registeredCommandActions).map(([key, value]) => [key, { description: value.description }])
    ),
  });
}

export async function POST(request: Request) {
  try {
    const actor = await getCurrentUserOrThrow();
    const body = await request.json();
    const action = typeof body?.action === "string" ? body.action : "";
    const params = body?.params && typeof body.params === "object" && !Array.isArray(body.params) ? body.params : {};
    if (!action) {
      return NextResponse.json({ ok: false, error: "action is required" }, { status: 400 });
    }
    const result = await executeRegisteredCommand(action, params, actor);
    return NextResponse.json({ ok: true, action, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Command failed";
    const status = message.includes("Authentication") || message.includes("Active user") ? 401 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
