import { setPreference } from "@/lib/memory";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { key?: unknown; value?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await setPreference(
    typeof body.key === "string" ? body.key : "",
    typeof body.value === "string" ? body.value : ""
  );
  if (!result.ok) return jsonResponse(request, { error: "key and value are required" }, { status: 400 });
  return jsonResponse(request, { ok: true, store: result.store }, { headers: { "Cache-Control": "no-store" } });
}