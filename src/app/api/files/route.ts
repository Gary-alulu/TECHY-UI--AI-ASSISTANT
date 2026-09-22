import { listDirectory, NotFoundError, OutsideWorkspaceError } from "@/lib/system/files";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get("path") ?? "";
  const requested = searchParams.get("scope") ?? "system";
  if (requested !== "device" && requested !== "system") {
    return jsonResponse(request, { error: "Scope must be 'system' or 'device'" }, { status: 400 });
  }

  try {
    const listing = await listDirectory(input, requested);
    return jsonResponse(request, listing, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OutsideWorkspaceError) {
      return jsonResponse(request, { error: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return jsonResponse(request, { error: error.message }, { status: 404 });
    }
    if (
      error instanceof Error &&
      (error.message.includes("EACCES") || error.message.includes("EPERM"))
    ) {
      return jsonResponse(request, { error: "Access denied" }, { status: 403 });
    }
    return jsonResponse(
      request,
      { error: error instanceof Error ? error.message : "Failed to read directory" },
      { status: 500 }
    );
  }
}