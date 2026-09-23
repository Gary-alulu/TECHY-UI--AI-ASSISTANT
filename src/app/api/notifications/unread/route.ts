import { getNotifications } from "@/lib/notifications";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { unread } = await getNotifications({ limit: 1 });
  return jsonResponse(request, { unread }, { headers: { "Cache-Control": "no-store" } });
}