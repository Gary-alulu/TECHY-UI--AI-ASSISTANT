import { getDeveloperSnapshot } from "@/lib/dev";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const snapshot = await getDeveloperSnapshot();
  return jsonResponse(request, { snapshot });
}