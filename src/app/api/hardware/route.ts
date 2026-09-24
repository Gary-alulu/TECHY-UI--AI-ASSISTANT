import { getHardwareDashboard } from "@/lib/system/devices";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const force = url.searchParams.get("refresh") === "1";
  const dashboard = await getHardwareDashboard(force);
  return jsonResponse(request, { dashboard }, { headers: { "Cache-Control": "no-store" } });
}