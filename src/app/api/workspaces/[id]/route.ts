import { deleteWorkspace, updateWorkspace } from "@/lib/workspaces";
import { jsonResponse } from "@/lib/http/response";
import type { WorkspaceLayout, WorkspaceSlot } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let body: { name?: unknown; description?: unknown; slots?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, { status: 400 });
  }
  const patch: Partial<Pick<WorkspaceLayout, "name" | "description" | "slots">> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.description === "string") patch.description = body.description;
  if (Array.isArray(body.slots)) patch.slots = body.slots as WorkspaceSlot[];

  const workspace = await updateWorkspace(id, patch);
  if (!workspace) return jsonResponse(request, { error: "Workspace not found" }, { status: 404 });
  return jsonResponse(request, { workspace }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const removed = await deleteWorkspace(id);
  if (!removed) return jsonResponse(request, { error: "Workspace not found" }, { status: 404 });
  return jsonResponse(request, { ok: true }, { headers: { "Cache-Control": "no-store" } });
}