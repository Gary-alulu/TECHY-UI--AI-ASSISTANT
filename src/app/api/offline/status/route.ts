import { getOfflineStatus } from "@/lib/offline";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const status = await getOfflineStatus();
  return jsonResponse(request, status, { headers: { "Cache-Control": "no-store" } });
}