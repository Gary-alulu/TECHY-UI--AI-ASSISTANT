import { deleteMeeting, summarizeMeetingNotes, updateMeeting } from "@/lib/meetings";
import { jsonResponse } from "@/lib/http/response";
import type { MeetingPatch } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: MeetingPatch = {};
  const stringFields: Array<keyof MeetingPatch> = ["title", "date", "status", "location", "notes", "summary"];
  for (const key of stringFields) {
    const value = body[key];
    if (typeof value === "string") Object.assign(patch, { [key]: value });
  }
  for (const key of ["participants", "agenda", "keyDecisions"] as const) {
    const value = body[key];
    if (Array.isArray(value)) Object.assign(patch, { [key]: value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) });
  }

  const meeting = await updateMeeting(id, patch);
  if (!meeting) return jsonResponse(request, { error: "Meeting not found" }, { status: 404 });
  return jsonResponse(request, { meeting }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const removed = await deleteMeeting(id);
  if (!removed) return jsonResponse(request, { error: "Meeting not found" }, { status: 404 });
  return jsonResponse(request, { ok: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const meeting = await updateMeeting(id, {});
  if (!meeting) return jsonResponse(request, { error: "Meeting not found" }, { status: 404 });
  const { summary, decisions } = await summarizeMeetingNotes(meeting);
  const updated = await updateMeeting(id, { summary, keyDecisions: decisions });
  return jsonResponse(request, { meeting: updated ?? meeting, summary, decisions }, { headers: { "Cache-Control": "no-store" } });
}