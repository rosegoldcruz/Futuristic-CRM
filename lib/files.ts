import { randomUUID } from "crypto";
import { mkdir, rename, rm, writeFile } from "fs/promises";
import path from "path";
import type { AppUser } from "@/lib/auth/access";
import { writeAuditEvent } from "@/lib/audit";
import { getPrisma } from "@/lib/prisma";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ATTACHABLE_OWNER_TYPES = new Set(["company", "contact", "campaign", "list"]);

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function storageConfig() {
  const driver = requireEnv("FILE_STORAGE_DRIVER");
  if (driver !== "local") {
    throw new Error(`Unsupported FILE_STORAGE_DRIVER: ${driver}`);
  }
  const root = path.resolve(requireEnv("FILE_STORAGE_ROOT"));
  return { driver, root };
}

function cleanFileName(name: string) {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "upload";
}

function safeJoin(root: string, ...parts: string[]) {
  const target = path.resolve(root, ...parts);
  const rel = path.relative(root, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Invalid storage path");
  }
  return target;
}

async function writeFileEvent(fileId: string | null, eventType: string, metadata: unknown) {
  await getPrisma().$executeRaw`
    INSERT INTO file_events (file_id, event_type, metadata)
    VALUES (${fileId}::uuid, ${eventType}, ${JSON.stringify(metadata ?? {})}::jsonb)
  `;
}

export async function createFolder(input: { name: string; parentId?: string | null }, actor: AppUser) {
  const name = cleanFileName(input.name);
  const parentId = input.parentId || null;
  const parentPath = parentId
    ? (await getPrisma().$queryRaw<Array<{ path: string }>>`SELECT path FROM file_folders WHERE id = ${parentId}::uuid LIMIT 1`)[0]?.path
    : "";
  if (parentId && parentPath === undefined) throw new Error("Parent folder not found");
  const folderPath = parentPath ? `${parentPath}/${name}` : name;
  const [folder] = await getPrisma().$queryRaw<Array<{ id: string; path: string }>>`
    INSERT INTO file_folders (parent_id, name, path)
    VALUES (${parentId}::uuid, ${name}, ${folderPath})
    ON CONFLICT (parent_id, name) DO UPDATE SET updated_at = now()
    RETURNING id::text, path
  `;
  await writeAuditEvent({ actor, entityType: "file_folder", entityId: folder.id, action: "create", metadata: { path: folder.path } });
  return folder;
}

export async function uploadFileRecord(
  input: { file: File; folderId?: string | null; ownerType?: string | null; ownerId?: string | null },
  actor: AppUser
) {
  const { driver, root } = storageConfig();
  if (input.file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Upload limit exceeded: ${MAX_UPLOAD_BYTES} bytes`);
  }
  const folderId = input.folderId || null;
  const folderPath = folderId
    ? (await getPrisma().$queryRaw<Array<{ path: string }>>`SELECT path FROM file_folders WHERE id = ${folderId}::uuid LIMIT 1`)[0]?.path
    : "";
  if (folderId && folderPath === undefined) throw new Error("Folder not found");

  const originalName = cleanFileName(input.file.name);
  const extension = path.extname(originalName);
  const storageName = `${randomUUID()}${extension}`;
  const relativePath = folderPath ? `${folderPath}/${storageName}` : storageName;
  const absolutePath = safeJoin(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from(await input.file.arrayBuffer()));

  const [record] = await getPrisma().$queryRaw<Array<{ id: string }>>`
    INSERT INTO files (folder_id, owner_type, owner_id, original_name, storage_name, mime_type, size_bytes, storage_driver, storage_path)
    VALUES (${folderId}::uuid, ${input.ownerType ?? null}, ${input.ownerId ?? null}::uuid, ${originalName}, ${storageName}, ${input.file.type || null}, ${BigInt(input.file.size)}, ${driver}, ${relativePath})
    RETURNING id::text
  `;
  await writeFileEvent(record.id, "uploaded", { originalName, storagePath: relativePath });
  await writeAuditEvent({ actor, entityType: "file", entityId: record.id, action: "upload", metadata: { originalName, folderId } });
  return record;
}

export async function moveFile(fileId: string, folderId: string | null, actor: AppUser) {
  const { root } = storageConfig();
  const [file] = await getPrisma().$queryRaw<Array<{ storage_path: string; storage_name: string }>>`
    SELECT storage_path, storage_name FROM files WHERE id = ${fileId}::uuid AND status = 'active' LIMIT 1
  `;
  if (!file) throw new Error("File not found");
  const folderPath = folderId
    ? (await getPrisma().$queryRaw<Array<{ path: string }>>`SELECT path FROM file_folders WHERE id = ${folderId}::uuid LIMIT 1`)[0]?.path
    : "";
  if (folderId && folderPath === undefined) throw new Error("Folder not found");
  const nextPath = folderPath ? `${folderPath}/${file.storage_name}` : file.storage_name;
  const from = safeJoin(root, file.storage_path);
  const to = safeJoin(root, nextPath);
  await mkdir(path.dirname(to), { recursive: true });
  await rename(from, to);
  await getPrisma().$executeRaw`
    UPDATE files SET folder_id = ${folderId}::uuid, storage_path = ${nextPath}, updated_at = now() WHERE id = ${fileId}::uuid
  `;
  await writeFileEvent(fileId, "moved", { from: file.storage_path, to: nextPath });
  await writeAuditEvent({ actor, entityType: "file", entityId: fileId, action: "move", metadata: { folderId } });
  return { id: fileId, storagePath: nextPath };
}

export async function archiveFile(fileId: string, actor: AppUser) {
  const { root } = storageConfig();
  const [file] = await getPrisma().$queryRaw<Array<{ storage_path: string }>>`
    SELECT storage_path FROM files WHERE id = ${fileId}::uuid LIMIT 1
  `;
  if (!file) throw new Error("File not found");
  await rm(safeJoin(root, file.storage_path), { force: true });
  await getPrisma().$executeRaw`UPDATE files SET status = 'archived', updated_at = now() WHERE id = ${fileId}::uuid`;
  await writeFileEvent(fileId, "archived", {});
  await writeAuditEvent({ actor, entityType: "file", entityId: fileId, action: "archive" });
  return { id: fileId };
}

export async function attachFileToEntity(fileId: string, ownerType: string, ownerId: string, actor: AppUser) {
  if (!ATTACHABLE_OWNER_TYPES.has(ownerType)) throw new Error("Unsupported owner_type");
  await getPrisma().$executeRaw`
    UPDATE files SET owner_type = ${ownerType}, owner_id = ${ownerId}::uuid, updated_at = now() WHERE id = ${fileId}::uuid
  `;
  await writeFileEvent(fileId, "attached", { ownerType, ownerId });
  await writeAuditEvent({ actor, entityType: "file", entityId: fileId, action: "attach", metadata: { ownerType, ownerId } });
  return { id: fileId, ownerType, ownerId };
}

export async function listFolderContents(folderId?: string | null) {
  const prisma = getPrisma();
  const [folders, files] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; name: string; path: string; updated_at: Date }>>`
      SELECT id::text, name, path, updated_at
      FROM file_folders
      WHERE (${folderId ?? null}::uuid IS NULL AND parent_id IS NULL) OR parent_id = ${folderId ?? null}::uuid
      ORDER BY name
    `,
    prisma.$queryRaw<Array<{ id: string; original_name: string; mime_type: string | null; size_bytes: bigint; owner_type: string | null; owner_id: string | null; updated_at: Date }>>`
      SELECT id::text, original_name, mime_type, size_bytes, owner_type, owner_id::text, updated_at
      FROM files
      WHERE status = 'active' AND ((${folderId ?? null}::uuid IS NULL AND folder_id IS NULL) OR folder_id = ${folderId ?? null}::uuid)
      ORDER BY updated_at DESC
    `,
  ]);
  return { folders, files };
}
