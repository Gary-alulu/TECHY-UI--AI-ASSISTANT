import { dismissReminder } from "@/lib/reminders";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { taskId?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, { status: 400 });
  }

  const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
  if (!taskId) return jsonResponse(request, { error: "taskId is required" }, { status: 400 });

  const dismissed = await dismissReminder(taskId);
  return jsonResponse(request, { ok: true, dismissed }, { headers: { "Cache-Control": "no-store" } });
}