import { removePreference } from "@/lib/memory";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  const removed = await removePreference(decodeURIComponent(key));
  if (!removed) return jsonResponse(request, { error: "Preference not found" }, { status: 404 });
  return jsonResponse(request, { ok: true }, { headers: { "Cache-Control": "no-store" } });
}