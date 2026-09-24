import { getNetworkIntelligence } from "@/lib/system/network";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const network = await getNetworkIntelligence();
  return jsonResponse(request, { network }, { headers: { "Cache-Control": "no-store" } });
}