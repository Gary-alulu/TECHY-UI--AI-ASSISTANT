import { deleteConversation, getConversation, renameConversation } from "@/lib/conversations";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const conversation = await getConversation(id);
  if (!conversation) return jsonResponse(request, { error: "Conversation not found" }, { status: 404 });
  return jsonResponse(request, { conversation }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let title: unknown;
  try {
    const body = (await request.json()) as { title?: unknown };
    title = body.title;
  } catch {
    return jsonResponse(request, { error: "Invalid request body" }, { status: 400 });
  }
  if (typeof title !== "string") {
    return jsonResponse(request, { error: "Title must be a string" }, { status: 400 });
  }
  const renamed = await renameConversation(id, title);
  if (!renamed) return jsonResponse(request, { error: "Conversation not found" }, { status: 404 });
  return jsonResponse(request, { ok: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const deleted = await deleteConversation(id);
  if (!deleted) return jsonResponse(request, { error: "Conversation not found" }, { status: 404 });
  return jsonResponse(request, { ok: true }, { headers: { "Cache-Control": "no-store" } });
}