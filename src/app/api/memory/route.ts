import { getMemory, addFact, clearMemory } from "@/lib/memory";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const memory = await getMemory();
  return jsonResponse(request, memory, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: { content?: unknown; kind?: unknown; source?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return jsonResponse(request, { error: "content is required" }, { status: 400 });

  const result = await addFact({
    content,
    kind: body.kind === "preference" ? "preference" : "fact",
    source: typeof body.source === "string" ? body.source : undefined,
  });
  if (!result.fact) return jsonResponse(request, { error: "That fact is already remembered" }, { status: 409 });
  return jsonResponse(request, { fact: result.fact, store: result.store }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  await clearMemory();
  return jsonResponse(request, { ok: true }, { headers: { "Cache-Control": "no-store" } });
}