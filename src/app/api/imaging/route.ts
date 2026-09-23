import { inspectImage, listWorkspaceImages } from "@/lib/imaging";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pathParam = url.searchParams.get("path");
  if (pathParam) {
    try {
      const inspection = await inspectImage(pathParam);
      return jsonResponse(request, { inspection });
    } catch (error) {
      return jsonResponse(request, { error: error instanceof Error ? error.message : "Could not inspect image" }, { status: 400 });
    }
  }
  const images = await listWorkspaceImages();
  return jsonResponse(request, { images });
}