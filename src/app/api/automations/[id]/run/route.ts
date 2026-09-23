import { runAutomation, ensureAutomationDirs } from "@/lib/automation";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await ensureAutomationDirs();
  try {
    const run = await runAutomation(id);
    return jsonResponse(request, { run });
  } catch (error) {
    return jsonResponse(request, { error: error instanceof Error ? error.message : "Run failed" }, { status: 404 });
  }
}