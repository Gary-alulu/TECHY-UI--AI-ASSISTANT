import { getEvents, addEvent } from "@/lib/calendar";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const options = {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  };
  if (from === "invalid" || Number.isNaN(options.from?.getTime() ?? 0)) {
    return jsonResponse(request, { error: "Invalid from date" }, { status: 400 });
  }
  const events = await getEvents(options);
  return jsonResponse(request, { events }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: { title?: unknown; start?: unknown; end?: unknown; location?: unknown; notes?: unknown; color?: unknown; attendees?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid request body" }, { status: 400 });
  }
  if (typeof body.title !== "string" || !body.title.trim()) {
    return jsonResponse(request, { error: "Title is required" }, { status: 400 });
  }
  const start = typeof body.start === "string" ? new Date(body.start) : undefined;
  if (!start || Number.isNaN(start.getTime())) {
    return jsonResponse(request, { error: "A valid start time is required" }, { status: 400 });
  }
  const end = typeof body.end === "string" ? new Date(body.end) : undefined;
  try {
    const event = await addEvent({
      title: body.title,
      start,
      end,
      location: typeof body.location === "string" ? body.location : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      color: typeof body.color === "string" ? body.color : undefined,
      attendees: Array.isArray(body.attendees) ? body.attendees.filter((a): a is string => typeof a === "string") : undefined,
    });
    return jsonResponse(request, { event }, { status: 201 });
  } catch (error) {
    return jsonResponse(request, { error: error instanceof Error ? error.message : "Failed to create event" }, { status: 400 });
  }
}