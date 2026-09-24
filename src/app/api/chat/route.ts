import { askLocalModel } from "@/lib/ai/ollama";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGES = 20;

export async function POST(request: Request) {
  let body: { messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { available: false, reply: null }, { status: 400 });
  }

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const messages = rawMessages
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) return null;
      const candidate = entry as { role?: unknown; content?: unknown };
      const role = candidate.role;
      const content = typeof candidate.content === "string" ? candidate.content.trim() : "";
      if (role !== "user" && role !== "assistant") return null;
      if (!content) return null;
      return { role, content };
    })
    .filter((entry): entry is { role: "user" | "assistant"; content: string } => entry !== null)
    .slice(-MAX_MESSAGES);

  if (messages.length === 0) {
    return jsonResponse(request, { available: false, reply: null }, { status: 400 });
  }

  const reply = await askLocalModel(messages);
  if (reply === null) {
    return jsonResponse(request, { available: false, reply: null }, { headers: { "Cache-Control": "no-store" } });
  }

  return jsonResponse(request, { available: true, reply }, { headers: { "Cache-Control": "no-store" } });
}