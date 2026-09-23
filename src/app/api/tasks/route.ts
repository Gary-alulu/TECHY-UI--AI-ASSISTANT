import { addTask, getTasks } from "@/lib/tasks";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tasks = await getTasks();
  return jsonResponse(request, { tasks, count: tasks.length }, { headers: { "Cache-Control": "no-store" } });
}

function parseIso(value: unknown): Date | undefined {
  if (typeof value !== "string" && !(value instanceof Date)) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function POST(request: Request) {
  let body: { title?: unknown; description?: unknown; dueTime?: unknown; remindAt?: unknown; repeat?: unknown; priority?: unknown; tags?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return jsonResponse(request, { error: "Task title is required" }, { status: 400 });
  if (title.length > 200) return jsonResponse(request, { error: "Task title must be 200 characters or fewer" }, { status: 400 });

  const tags = Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string") : undefined;

  const task = await addTask({
    title,
    description: typeof body.description === "string" ? body.description : undefined,
    dueTime: typeof body.dueTime === "string" ? body.dueTime : undefined,
    remindAt: parseIso(body.remindAt),
    repeat: typeof body.repeat === "string" ? (body.repeat as Parameters<typeof addTask>[0]["repeat"]) : undefined,
    priority: typeof body.priority === "string" ? body.priority : undefined,
    tags,
  });

  return jsonResponse(request, { task }, { status: 201, headers: { "Cache-Control": "no-store" } });
}