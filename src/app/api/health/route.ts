import { getSystemHealth } from "@/lib/health";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const health = await getSystemHealth();
  return jsonResponse(request, { health }, { headers: { "Cache-Control": "no-store" } });
}