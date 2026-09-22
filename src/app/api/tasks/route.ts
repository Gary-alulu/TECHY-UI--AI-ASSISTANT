import { addTask, getTasks } from "@/lib/tasks";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tasks = await getTasks();
  return jsonResponse(request, { tasks, count: tasks.length }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: { title?: unknown; dueTime?: unknown; priority?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return jsonResponse(request, { error: "Task title is required" }, { status: 400 });
  if (title.length > 200) return jsonResponse(request, { error: "Task title must be 200 characters or fewer" }, { status: 400 });

  const task = await addTask({
    title,
    dueTime: typeof body.dueTime === "string" ? body.dueTime : undefined,
    priority: typeof body.priority === "string" ? body.priority : undefined,
  });

  return jsonResponse(request, { task }, { status: 201, headers: { "Cache-Control": "no-store" } });
}