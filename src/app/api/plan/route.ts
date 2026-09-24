import { buildPlanReport, planForGoal, type TaskPlan } from "@/lib/planner";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { goal?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, { status: 400 });
  }

  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  if (!goal) return jsonResponse(request, { error: "goal is required" }, { status: 400 });
  if (goal.length > 300) return jsonResponse(request, { error: "goal is too long (max 300 chars)" }, { status: 400 });

  const plan: TaskPlan = planForGoal(goal);
  const report = await buildPlanReport(plan);
  return jsonResponse(request, { plan, report }, { headers: { "Cache-Control": "no-store" } });
}