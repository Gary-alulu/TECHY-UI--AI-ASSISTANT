import { sweepAutomations, ensureAutomationDirs } from "@/lib/automation";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureAutomationDirs();
  const { fired } = await sweepAutomations();
  return jsonResponse(request, { fired: fired.length }, { headers: { "Cache-Control": "no-store" } });
}