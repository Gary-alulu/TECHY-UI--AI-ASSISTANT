import { updateAutomation, deleteAutomation } from "@/lib/automation";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid request body" }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.description === "string") patch.description = body.description;
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (body.trigger && typeof body.trigger === "object") patch.trigger = body.trigger;
  if (Array.isArray(body.actions)) patch.actions = body.actions;
  const updated = await updateAutomation(id, patch);
  if (!updated) return jsonResponse(request, { error: "Workflow not found" }, { status: 404 });
  return jsonResponse(request, { automation: updated });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const removed = await deleteAutomation(id);
  if (!removed) return jsonResponse(request, { error: "Workflow not found" }, { status: 404 });
  return jsonResponse(request, { ok: true });
}