import { createConversation, listConversations } from "@/lib/conversations";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { summaries, current } = await listConversations();
  return jsonResponse(
    request,
    { conversations: summaries, current },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const conversation = await createConversation();
  return jsonResponse(
    request,
    { conversation },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}