import { getReminderSnapshot } from "@/lib/reminders";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { due, upcoming } = await getReminderSnapshot();
  return jsonResponse(
    request,
    { due, upcoming, dueCount: due.length, upcomingCount: upcoming.length },
    { headers: { "Cache-Control": "no-store" } }
  );
}