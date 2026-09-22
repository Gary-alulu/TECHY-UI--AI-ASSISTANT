import { jsonResponse } from "@/lib/http/response";
import { listRecents, touchRecent } from "@/lib/system/recents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const recents = await listRecents();
  return jsonResponse(request, { recents }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: { path?: unknown; name?: unknown; kind?: unknown; size?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid request body" }, { status: 400 });
  }
  const target = typeof body.path === "string" ? body.path.trim() : "";
  if (!target) return jsonResponse(request, { error: "A path is required" }, { status: 400 });

  const recents = await touchRecent({
    path: target,
    name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : target,
    kind: body.kind === "directory" ? "directory" : "file",
    size: typeof body.size === "number" && Number.isFinite(body.size) ? body.size : undefined,
  });
  return jsonResponse(request, { recents }, { status: 201, headers: { "Cache-Control": "no-store" } });
}