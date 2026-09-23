import { listPlugins, installPlugin, PLUGIN_GROUPS } from "@/lib/plugins";
import { jsonResponse } from "@/lib/http/response";
import type { PluginCategory } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const plugins = await listPlugins();
  return jsonResponse(request, { plugins, groups: PLUGIN_GROUPS });
}

export async function POST(request: Request) {
  let body: { name?: unknown; description?: unknown; category?: unknown; permissions?: unknown; inputs?: unknown; outputs?: unknown; execute?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid request body" }, { status: 400 });
  }
  if (typeof body.name !== "string" || !body.name.trim()) {
    return jsonResponse(request, { error: "Plugin name is required" }, { status: 400 });
  }
  const categories: PluginCategory[] = ["Core", "File", "System", "Browser", "Developer", "Creative", "Custom"];
  const category = (typeof body.category === "string" && (categories as string[]).includes(body.category) ? body.category : "Custom") as PluginCategory;
  const stringList = (value: unknown) => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []);
  const execute = (body.execute ?? {}) as { action?: string; tool?: string; args?: Record<string, unknown>; message?: string; output?: string };
  if (execute.action !== "tool" && execute.action !== "notify" && execute.action !== "text") {
    return jsonResponse(request, { error: "execute.action must be tool, notify or text" }, { status: 400 });
  }
  try {
    const plugin = await installPlugin({
      name: body.name,
      description: typeof body.description === "string" ? body.description : body.name,
      category,
      permissions: stringList(body.permissions),
      inputs: stringList(body.inputs),
      outputs: stringList(body.outputs),
      execute: { action: execute.action, tool: execute.tool, args: execute.args, message: execute.message, output: execute.output },
    });
    return jsonResponse(request, { plugin }, { status: 201 });
  } catch (error) {
    return jsonResponse(request, { error: error instanceof Error ? error.message : "Failed to install plugin" }, { status: 400 });
  }
}