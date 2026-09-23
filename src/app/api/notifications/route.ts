import { getNotifications, markNotificationRead, markAllNotificationsRead, clearNotifications } from "@/lib/notifications";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 40);
  const { notifications, unread } = await getNotifications({ limit: Number.isFinite(limit) ? limit : 40 });
  return jsonResponse(request, { notifications, unread }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: { id?: unknown; all?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid request body" }, { status: 400 });
  }
  if (body.all === true) {
    await markAllNotificationsRead();
    return jsonResponse(request, { ok: true });
  }
  if (typeof body.id !== "string" || !body.id) {
    return jsonResponse(request, { error: "Notification id is required" }, { status: 400 });
  }
  await markNotificationRead(body.id);
  return jsonResponse(request, { ok: true });
}

export async function DELETE(request: Request) {
  await clearNotifications();
  return jsonResponse(request, { ok: true });
}