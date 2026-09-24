import { buildPlanReport, executePlan, planForGoal, type PlanStep, type TaskPlan } from "@/lib/planner";
import { ACTIVITY_KIND } from "@/lib/ai/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StreamContext {
  controller: ReadableStreamDefaultController<Uint8Array>;
}

function emit(context: StreamContext, event: Record<string, unknown>): void {
  try {
    context.controller.enqueue(new TextEncoder().encode(`${JSON.stringify(event)}\n`));
  } catch {
    // client disconnected
  }
}

export async function POST(request: Request) {
  let body: { goal?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  if (!goal) return new Response(JSON.stringify({ error: "goal is required" }), { status: 400, headers: { "Content-Type": "application/json" } });

  const plan: TaskPlan = planForGoal(goal);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const context: StreamContext = { controller };
      void (async () => {
        emit(context, { type: "plan", goal: plan.goal, slug: plan.slug, intent: plan.intent });
        try {
          await executePlan(plan, ({ step, index }) => {
            emit(context, {
              type: "step",
              index,
              status: step.status,
              title: step.title,
              ...(step.result !== undefined ? { result: step.result } : {}),
            });
          });
          const report = await buildPlanReport(plan);
          emit(context, {
            type: "report",
            steps: plan.steps.map((step: PlanStep) => ({ id: step.id, title: step.title, status: step.status, result: step.result })),
            markdown: report,
          });
        } catch (error) {
          emit(context, { type: "error", message: error instanceof Error ? error.message : "Plan execution failed" });
        } finally {
          try {
            controller.close();
          } catch {
            // already closed
          }
          try {
            const { logActivity } = await import("@/lib/activity");
            await logActivity({
              actor: "techy",
              kind: ACTIVITY_KIND.get_developer_snapshot ?? "chat",
              action: "Task plan executed",
              detail: `${plan.goal} — ${plan.steps.filter((step) => step.status === "done").length}/${plan.steps.length} steps done`,
            });
          } catch {
            // best-effort
          }
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}