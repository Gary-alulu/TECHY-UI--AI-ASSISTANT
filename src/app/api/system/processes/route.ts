import { getTopProcesses } from "@/lib/system/hardware";
import { jsonResponse } from "@/lib/http/response";
import type { ProcessInfo } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 5), 50) : 20;

  const processes: ProcessInfo[] = await getTopProcesses(limit);

  return jsonResponse(request, { processes, count: processes.length }, { headers: { "Cache-Control": "no-store" } });
}