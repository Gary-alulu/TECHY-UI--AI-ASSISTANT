import { AGENTS } from "@/lib/agents";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return jsonResponse(request, { agents: AGENTS }, { headers: { "Cache-Control": "no-store" } });
}