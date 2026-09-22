import { deleteTask, updateTask, type TaskPatch } from "@/lib/tasks";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUS: TaskPatch["status"][] = ["todo", "in_progress", "completed", "cancelled"];
const ALLOWED_PRIORITY: TaskPatch["priority"][] = ["low", "medium", "high", "urgent"];

function buildPatch(value: unknown): TaskPatch | null {
  if (typeof value !== "object" || value === null) return null;
  const patch: TaskPatch = {};

  if ("title" in value) {
    const title = typeof value.title === "string" ? value.title.trim() : "";
    if (!title || title.length > 200) return null;
    patch.title = title;
  }
  if ("dueTime" in value) {
    patch.dueTime = typeof value.dueTime === "string" ? value.dueTime : "";
  }
  if ("priority" in value) {
    const priority = value.priority;
    if (typeof priority !== "string" || !ALLOWED_PRIORITY.includes(priority as TaskPatch["priority"])) return null;
    patch.priority = priority as TaskPatch["priority"];
  }
  if ("status" in value) {
    const status = value.status;
    if (typeof status !== "string" || !ALLOWED_STATUS.includes(status as TaskPatch["status"])) return null;
    patch.status = status as TaskPatch["status"];
  }

  return patch;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, { status: 400 });
  }

  const patch = buildPatch(body);
  if (!patch) return jsonResponse(request, { error: "Invalid task update payload" }, { status: 400 });

  const task = await updateTask(id, patch);
  if (!task) return jsonResponse(request, { error: "Task not found" }, { status: 404 });

  return jsonResponse(request, { task }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const deleted = await deleteTask(id);
  if (!deleted) return jsonResponse(request, { error: "Task not found" }, { status: 404 });
  return jsonResponse(request, { ok: true }, { headers: { "Cache-Control": "no-store" } });
}