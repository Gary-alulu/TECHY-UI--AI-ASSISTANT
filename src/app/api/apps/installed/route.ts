import { getInstalledApps } from "@/lib/system/apps";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";

  try {
    const apps = await getInstalledApps(forceRefresh);
    return jsonResponse(request, { apps, count: apps.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonResponse(
      request,
      { apps: [], count: 0, error: error instanceof Error ? error.message : "Failed to enumerate apps" },
      { status: 500 }
    );
  }
}