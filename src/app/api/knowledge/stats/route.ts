import { buildKnowledgeIndex } from "@/lib/knowledge";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const force = url.searchParams.get("refresh") === "1";
  const index = await buildKnowledgeIndex(force);
  return jsonResponse(
    request,
    {
      files: index.documents.length,
      bytes: index.bytes,
      builtAt: new Date(index.builtAt).toISOString(),
      roots: ["workspace only"],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}