import { jsonResponse } from "@/lib/http/response";
import { resolveDeviceTarget, resolveSystemTarget, NotFoundError } from "@/lib/system/files";
import { buildPreview } from "@/lib/system/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SCOPES = ["system", "device"] as const;
type Scope = (typeof ALLOWED_SCOPES)[number];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawPath = url.searchParams.get("path") ?? "";
  const scope = url.searchParams.get("scope");
  const allowedScope: Scope = scope === "device" ? "device" : "system";

  if (!rawPath) return jsonResponse(request, { error: "A path is required" }, { status: 400 });
  if (!ALLOWED_SCOPES.includes(allowedScope)) return jsonResponse(request, { error: "Invalid scope" }, { status: 400 });

  let target: string;
  try {
    target = allowedScope === "device" ? resolveDeviceTarget(rawPath) : resolveSystemTarget(rawPath);
  } catch {
    return jsonResponse(request, { error: "Path is outside the allowed scope" }, { status: 400 });
  }

  try {
    const preview = await buildPreview(target);
    return jsonResponse(request, preview, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof NotFoundError) return jsonResponse(request, { error: error.message }, { status: 404 });
    return jsonResponse(request, { error: "Could not preview this file" }, { status: 500 });
  }
}