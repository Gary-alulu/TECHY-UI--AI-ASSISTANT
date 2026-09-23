import { searchKnowledge } from "@/lib/knowledge";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";

  const { hits, indexed } = await searchKnowledge(query, 12);
  return jsonResponse(request, { query, hits, indexed }, { headers: { "Cache-Control": "no-store" } });
}