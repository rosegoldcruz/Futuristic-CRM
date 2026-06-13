import { NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth/access";
import { createFolder, listFolderContents, uploadFileRecord } from "@/lib/files";

function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

export async function GET(request: Request) {
  try {
    await getCurrentUserOrThrow();
    const url = new URL(request.url);
    const folderId = url.searchParams.get("folder_id");
    const result = await listFolderContents(folderId);
    return NextResponse.json(jsonSafe(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : "File list failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getCurrentUserOrThrow();
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ ok: false, error: "file is required" }, { status: 400 });
      }
      const record = await uploadFileRecord(
        {
          file,
          folderId: String(formData.get("folder_id") || "") || null,
          ownerType: String(formData.get("owner_type") || "") || null,
          ownerId: String(formData.get("owner_id") || "") || null,
        },
        actor
      );
      return NextResponse.json({ ok: true, file: record });
    }

    const body = await request.json();
    if (body?.action === "create_folder") {
      const folder = await createFolder({ name: String(body.name || ""), parentId: body.parent_id || null }, actor);
      return NextResponse.json({ ok: true, folder });
    }

    return NextResponse.json({ ok: false, error: "Unsupported file action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "File action failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
