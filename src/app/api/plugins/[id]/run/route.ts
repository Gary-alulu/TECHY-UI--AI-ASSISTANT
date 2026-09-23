import { runPlugin } from "@/lib/plugins";
import { logActivity } from "@/lib/activity";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await runPlugin(id);
  await logActivity({ actor: "automation", kind: "automation", action: "Plugin executed", detail: result.action || id });
  return jsonResponse(request, result);
}