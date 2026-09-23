import { getEvent } from "@/lib/calendar";
import { prepareForEvent } from "@/lib/prep";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { id?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid request body" }, { status: 400 });
  }
  if (typeof body.id !== "string" || !body.id) {
    return jsonResponse(request, { error: "Event id is required" }, { status: 400 });
  }
  const event = await getEvent(body.id);
  if (!event) return jsonResponse(request, { error: "Event not found" }, { status: 404 });

  const result = await prepareForEvent(event);
  return jsonResponse(request, { findings: result.findings, summary: result.summary });
}