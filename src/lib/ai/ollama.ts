const OLLAMA_TAGS = "http://localhost:11434/api/tags";
const OLLAMA_CHAT = "http://localhost:11434/api/chat";

export const TECHY_SYSTEM_PROMPT =
  "You are TECHY, a local-first AI assistant running on the user's desktop machine. " +
  "Be concise and helpful. Answer directly from your own knowledge; do not claim to " +
  "have checked the user's system, files, or apps unless you actually did.";

export async function pickLocalModel(): Promise<string | null> {
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

export async function askLocalModel(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  options: { system?: string; timeoutMs?: number } = {}
): Promise<string | null> {
  const model = await pickLocalModel();
  if (!model) return null;

  const systemContent = options.system ?? TECHY_SYSTEM_PROMPT;
  try {
    const response = await fetch(OLLAMA_CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemContent }, ...messages],
        stream: false,
        options: { num_ctx: 8192 },
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { message?: { content?: string } };
    const reply = data?.message?.content;
    return typeof reply === "string" && reply.trim() ? reply.trim() : null;
  } catch {
    return null;
  }
}