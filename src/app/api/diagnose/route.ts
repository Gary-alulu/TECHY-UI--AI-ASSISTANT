import { getDiagnostic } from "@/lib/health";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const diagnostic = await getDiagnostic();
  return jsonResponse(request, { diagnostic }, { headers: { "Cache-Control": "no-store" } });
}