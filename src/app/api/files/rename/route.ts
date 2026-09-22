import { promises as fs } from "node:fs";
import path from "node:path";
import { jsonResponse } from "@/lib/http/response";
import { OutsideWorkspaceError, resolveDeviceTarget, resolveSystemTarget } from "@/lib/system/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { path?: unknown; newName?: unknown; scope?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid request body" }, { status: 400 });
  }

  const target = typeof body.path === "string" ? body.path.trim() : "";
  const newName = typeof body.newName === "string" ? body.newName.trim() : "";
  const scope = body.scope === "device" ? "device" : "system";

  if (!target || !newName) return jsonResponse(request, { error: "Path and new name are required" }, { status: 400 });
  if (newName.includes("/") || newName.includes("\\") || newName === "." || newName === ".." || /^\.{1,2}$/.test(newName)) {
    return jsonResponse(request, { error: "Invalid file name" }, { status: 400 });
  }
  if (newName.length > 180) return jsonResponse(request, { error: "File name too long" }, { status: 400 });

  let resolved: string;
  try {
    resolved = scope === "device" ? resolveDeviceTarget(target) : resolveSystemTarget(target);
  } catch (error) {
    if (error instanceof OutsideWorkspaceError) return jsonResponse(request, { error: error.message }, { status: 400 });
    return jsonResponse(request, { error: "Path is outside the allowed scope" }, { status: 400 });
  }

  const dir = path.dirname(resolved);
  const next = path.join(dir, newName);

  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch {
    return jsonResponse(request, { error: "Source does not exist" }, { status: 404 });
  }

  try {
    await fs.stat(next);
    return jsonResponse(request, { error: "A file with that name already exists" }, { status: 409 });
  } catch {
    // target is free
  }

  try {
    await fs.rename(resolved, next);
  } catch (error) {
    return jsonResponse(request, { error: error instanceof Error ? error.message : "Rename failed" }, { status: 500 });
  }

  return jsonResponse(request, {
    ok: true,
    path: next,
    name: newName,
    kind: stat.isDirectory() ? "directory" : "file",
    size: stat.isDirectory() ? undefined : stat.size,
  }, { headers: { "Cache-Control": "no-store" } });
}