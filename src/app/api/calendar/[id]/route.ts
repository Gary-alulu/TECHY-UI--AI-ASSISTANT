import { updateEvent, removeEvent, type CalendarPatch } from "@/lib/calendar";
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
  const patch: CalendarPatch = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.start === "string") patch.start = body.start;
  if (body.end !== undefined) patch.end = typeof body.end === "string" ? body.end : null;
  if (typeof body.location === "string") patch.location = body.location;
  if (Array.isArray(body.attendees)) patch.attendees = body.attendees.filter((a): a is string => typeof a === "string");
  if (typeof body.notes === "string") patch.notes = body.notes;
  if (typeof body.color === "string") patch.color = body.color;
  const updated = await updateEvent(id, patch);
  if (!updated) return jsonResponse(request, { error: "Event not found" }, { status: 404 });
  return jsonResponse(request, { event: updated });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const removed = await removeEvent(id);
  if (!removed) return jsonResponse(request, { error: "Event not found" }, { status: 404 });
  return jsonResponse(request, { ok: true });
}