import { NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth/access";
import { archiveFile, attachFileToEntity, moveFile } from "@/lib/files";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const actor = await getCurrentUserOrThrow();
    const body = await request.json();
    if (body?.action === "move") {
      return NextResponse.json({ ok: true, file: await moveFile(params.id, body.folder_id || null, actor) });
    }
    if (body?.action === "attach") {
      return NextResponse.json({
        ok: true,
        file: await attachFileToEntity(params.id, String(body.owner_type || ""), String(body.owner_id || ""), actor),
      });
    }
    return NextResponse.json({ ok: false, error: "Unsupported file action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "File action failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const actor = await getCurrentUserOrThrow();
    return NextResponse.json({ ok: true, file: await archiveFile(params.id, actor) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "File archive failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
