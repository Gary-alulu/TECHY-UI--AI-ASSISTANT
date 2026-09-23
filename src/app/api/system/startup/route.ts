import { getStartupApps } from "@/lib/system/hardware";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startupApps = await getStartupApps();
  return jsonResponse(
    request,
    { startupApps, count: startupApps.length },
    { headers: { "Cache-Control": "no-store" } }
  );
}