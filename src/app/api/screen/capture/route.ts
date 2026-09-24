import { captureScreen, type ScreenSnapshot } from "@/lib/screen";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const snapshot: ScreenSnapshot = await captureScreen();
  return jsonResponse(request, snapshot, { headers: { "Cache-Control": "no-store" } });
}
