import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OLLAMA_TAGS = "http://localhost:11434/api/tags";
const OLLAMA_CHAT = "http://localhost:11434/api/chat";

const SYSTEM_PROMPT =
  "You are TECHY, a local-first AI assistant running on the user's desktop machine. " +
  "Be concise and helpful. Answer directly from your own knowledge; do not claim to " +
  "have checked the user's system, files, or apps unless you actually did.";

const MAX_MESSAGES = 20;

async function pickModel(): Promise<string | null> {
  try {
    const response = await fetch(OLLAMA_TAGS, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    const data = (await response.json()) as { models?: Array<{ name?: string }> };
    const models = (data.models ?? []).filter((model) => typeof model.name === "string" && model.name.length > 0);
    if (models.length === 0) return null;
    return models[0].name as string;
  } catch {
    return null;
  }
}

async function askOllama(messages: Array<{ role: "user" | "assistant" | "system"; content: string }>): Promise<string | null> {
  const model = await pickModel();
  if (!model) return null;

  try {
    const response = await fetch(OLLAMA_CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: false,
        options: { num_ctx: 8192 },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { message?: { content?: string } };
    const reply = data?.message?.content;
    return typeof reply === "string" && reply.trim() ? reply.trim() : null;
  } catch {
    return null;
  }
}

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

  const reply = await askOllama(messages);
  if (reply === null) {
    return jsonResponse(request, { available: false, reply: null }, { headers: { "Cache-Control": "no-store" } });
  }

  return jsonResponse(request, { available: true, reply }, { headers: { "Cache-Control": "no-store" } });
}