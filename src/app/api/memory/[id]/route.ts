import { removeFact } from "@/lib/memory";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const removed = await removeFact(id);
  if (!removed) return jsonResponse(request, { error: "Memory entry not found" }, { status: 404 });
  return jsonResponse(request, { ok: true }, { headers: { "Cache-Control": "no-store" } });
}