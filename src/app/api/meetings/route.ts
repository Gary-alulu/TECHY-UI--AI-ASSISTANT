import { addMeeting, getMeetings } from "@/lib/meetings";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const meetings = await getMeetings();
  return jsonResponse(request, { meetings }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: { title?: unknown; date?: unknown; location?: unknown; participants?: unknown; agenda?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return jsonResponse(request, { error: "Meeting title is required" }, { status: 400 });

  try {
    const meeting = await addMeeting({
      title,
      date: typeof body.date === "string" ? body.date : undefined,
      location: typeof body.location === "string" ? body.location : undefined,
      participants: Array.isArray(body.participants) ? body.participants.filter((item): item is string => typeof item === "string") : undefined,
      agenda: Array.isArray(body.agenda) ? body.agenda.filter((item): item is string => typeof item === "string") : undefined,
    });
    const { logActivity } = await import("@/lib/activity");
    await logActivity({ actor: "user", kind: "calendar", action: "Meeting created", detail: `“${meeting.title}” was added to your meetings` });
    return jsonResponse(request, { meeting }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create meeting";
    return jsonResponse(request, { error: message }, { status: 400 });
  }
}