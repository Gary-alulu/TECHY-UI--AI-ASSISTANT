import { addCommandHistory, addTemplate, clearHistory, deleteCommandHistory, deleteTemplate, getCommands } from "@/lib/commands";
import { jsonResponse } from "@/lib/http/response";
import type { CommandTemplate } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { history, templates } = await getCommands();
  return jsonResponse(request, { history, templates }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action;

  if (action === "template") {
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return jsonResponse(request, { error: "Template text is required" }, { status: 400 });
    const category = ["general", "files", "system", "apps", "productivity", "research"].includes(String(body.category))
      ? (body.category as CommandTemplate["category"])
      : "general";
    const template = await addTemplate({ text, label: typeof body.label === "string" ? body.label : undefined, description: typeof body.description === "string" ? body.description : undefined, category });
    if (!template) return jsonResponse(request, { error: "Template limit reached (40 max)" }, { status: 400 });
    return jsonResponse(request, { template }, { status: 201, headers: { "Cache-Control": "no-store" } });
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) return jsonResponse(request, { error: "Command text is required" }, { status: 400 });
  const entry = await addCommandHistory(text, typeof body.source === "string" ? body.source : "user");
  return jsonResponse(request, { entry }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const target = url.searchParams.get("target");

  if (target === "template") {
    if (!id) return jsonResponse(request, { error: "Template id required" }, { status: 400 });
    const removed = await deleteTemplate(id);
    return jsonResponse(request, { removed }, { headers: { "Cache-Control": "no-store" } });
  }
  if (target === "history") {
    if (!id) return jsonResponse(request, { error: "Command id required" }, { status: 400 });
    const removed = await deleteCommandHistory(id);
    return jsonResponse(request, { removed }, { headers: { "Cache-Control": "no-store" } });
  }
  if (target === "clear") {
    await clearHistory();
    return jsonResponse(request, { ok: true }, { headers: { "Cache-Control": "no-store" } });
  }
  return jsonResponse(request, { error: "Unknown target" }, { status: 400 });
}