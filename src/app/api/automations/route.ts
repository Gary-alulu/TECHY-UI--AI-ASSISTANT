import { getAutomations, createAutomation, sweepAutomations, ensureAutomationDirs, type AutomationTrigger, type AutomationAction } from "@/lib/automation";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureAutomationDirs();
  const { fired } = await sweepAutomations();
  const automations = await getAutomations();
  return jsonResponse(request, { automations, fired }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: { name?: unknown; description?: unknown; trigger?: unknown; actions?: unknown; enabled?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid request body" }, { status: 400 });
  }
  if (typeof body.name !== "string" || !body.name.trim()) {
    return jsonResponse(request, { error: "Workflow name is required" }, { status: 400 });
  }
  const trigger = body.trigger as AutomationTrigger | undefined;
  if (!trigger || typeof trigger.type !== "string") {
    return jsonResponse(request, { error: "A trigger is required" }, { status: 400 });
  }
  const actions = Array.isArray(body.actions)
    ? (body.actions as AutomationAction[]).filter((action) => typeof action.name === "string")
    : [];
  try {
    const automation = await createAutomation({
      name: body.name,
      description: typeof body.description === "string" ? body.description : undefined,
      trigger,
      actions,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    });
    return jsonResponse(request, { automation }, { status: 201 });
  } catch (error) {
    return jsonResponse(request, { error: error instanceof Error ? error.message : "Failed to create workflow" }, { status: 400 });
  }
}