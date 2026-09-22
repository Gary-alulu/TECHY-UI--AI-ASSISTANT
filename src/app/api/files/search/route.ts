import { jsonResponse } from "@/lib/http/response";
import { resolveDeviceTarget, resolveSystemTarget } from "@/lib/system/files";
import { searchFiles } from "@/lib/system/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { query?: unknown; scope?: unknown; root?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid request body" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) return jsonResponse(request, { error: "A search query is required" }, { status: 400 });
  if (query.length > 200) return jsonResponse(request, { error: "Search query too long" }, { status: 400 });

  const scope = body.scope === "device" ? "device" : "system";

  let root: string | undefined;
  if (typeof body.root === "string" && body.root.trim()) {
    try {
      root = scope === "device" ? resolveDeviceTarget(body.root.trim()) : resolveSystemTarget(body.root.trim());
    } catch {
      return jsonResponse(request, { error: "Search root is outside the allowed scope" }, { status: 400 });
    }
  }

  const result = await searchFiles({ query, scope, root });
  return jsonResponse(request, result, { headers: { "Cache-Control": "no-store" } });
}