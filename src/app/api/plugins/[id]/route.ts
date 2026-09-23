import { setPluginEnabled, removePlugin } from "@/lib/plugins";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let body: { enabled?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid request body" }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") {
    return jsonResponse(request, { error: "enabled must be a boolean" }, { status: 400 });
  }
  const plugin = await setPluginEnabled(id, body.enabled);
  return plugin ? jsonResponse(request, { plugin }) : jsonResponse(request, { error: "Plugin not found" }, { status: 404 });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const removed = await removePlugin(id);
  return removed ? jsonResponse(request, { ok: true }) : jsonResponse(request, { error: "Plugin not found" }, { status: 404 });
}