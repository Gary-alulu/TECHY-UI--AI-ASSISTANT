import { executeTool, ollamaTools, ACTIVITY_KIND } from "@/lib/ai/tools";
import { runSkillIfMatched, type SkillMatch } from "@/lib/ai/skills";
import { agentForTool } from "@/lib/agents";
import { memoryContext } from "@/lib/memory";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OLLAMA_BASE = "http://localhost:11434";
const MAX_MESSAGES = 24;
const MAX_TOOL_ROUNDS = 3;
const MAX_CONTEXT_CHARS = 48_000;

const SYSTEM_PROMPT =
  "You are TECHY, a local-first AI assistant running on the user's desktop machine. " +
  "You have tools that inspect and control the real machine (metrics, disk, processes, opening installed apps). " +
  "Use them when the user's request is about their system, files, storage, processes, or launching apps. " +
  "Cite what tools returned. Be concise. Never claim to have checked the system unless a tool result backs it up.";

interface ChatLine {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: Array<{ function: { name: string; arguments: string } }>;
  name?: string;
}

async function pickModel(): Promise<string | null> {
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    const data = (await response.json()) as { models?: Array<{ name?: string }> };
    const models = (data.models ?? []).filter((model) => typeof model.name === "string" && model.name.length > 0);
    if (models.length === 0) return null;
    const { getBranding } = await import("@/lib/branding");
    let preferred: string;
    try {
      const branding = await getBranding();
      preferred = branding.model?.trim().toLowerCase() ?? "auto";
    } catch {
      preferred = "auto";
    }
    if (preferred && preferred !== "auto") {
      const match = models.find((model) => (model.name as string).toLowerCase() === preferred || (model.name as string).toLowerCase().startsWith(`${preferred}:`));
      if (match) return match.name as string;
    }
    return models[0].name!;
  } catch {
    return null;
  }
}

/**
 * Streams one Ollama round with tools. Returns the final text and any tool
 * calls while forwarding every text token to the client as a delta.
 */
async function streamRound(
  context: StreamContext,
  model: string,
  messages: ChatLine[],
  signal: AbortSignal
): Promise<{ text: string; toolCalls: Array<{ function: { name: string; arguments: string } }> }> {
  let text = "";
  let toolCalls: Array<{ function: { name: string; arguments: string } }> = [];

  const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      tools: ollamaTools(),
      stream: true,
      options: { num_ctx: 8192 },
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Model responded with ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const rawLine of chunk.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      let data: { message?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: string } }> }; done?: boolean };
      try {
        data = JSON.parse(line);
      } catch {
        continue;
      }
      const delta = data.message?.content;
      if (delta) {
        text += delta;
        emit(context, { type: "delta", content: delta });
      }
      if (data.message?.tool_calls?.length) {
        toolCalls = data.message.tool_calls;
      }
      if (data.done) break;
    }
  }
  return { text, toolCalls };
}

interface StreamContext {
  controller: ReadableStreamDefaultController<Uint8Array>;
}

function emit(context: StreamContext, event: Record<string, unknown>): void {
  try {
    context.controller.enqueue(new TextEncoder().encode(`${JSON.stringify(event)}\n`));
  } catch {
    // client disconnected
  }
}

async function runConversation(
  context: StreamContext,
  model: string,
  sourceMessages: ChatLine[],
  signal: AbortSignal
): Promise<void> {
  emit(context, { type: "meta", available: true, model });

  const remembered = await memoryContext();
  const messages: ChatLine[] = [{ role: "system", content: SYSTEM_PROMPT + remembered }, ...sourceMessages];
  const executions: Array<Record<string, unknown>> = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const { text, toolCalls } = await streamRound(context, model, messages, signal);

    if (toolCalls.length > 0) {
      if (text) messages.push({ role: "assistant", content: text, tool_calls: toolCalls });
      else messages.push({ role: "assistant", content: "", tool_calls: toolCalls });

      for (const call of toolCalls) {
        const toolName = call.function?.name ?? "unknown";
        let args: unknown = {};
        if (typeof call.function?.arguments === "string") {
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            args = { raw: call.function.arguments };
          }
        }
        emit(context, { type: "status", state: "executing", tool: toolName, detail: JSON.stringify(args) });
        const startedAt = Date.now();
        const result = await executeTool(toolName, args);
        const execution = {
          id: randomUUID(),
          toolName,
          status: result.ok ? "completed" : "failed",
          input: args,
          output: result.output,
          error: result.error,
          duration: Date.now() - startedAt,
        };
        executions.push(execution);
        emit(context, { type: "tool", execution });
        messages.push({
          role: "tool",
          name: toolName,
          content: result.ok ? result.output : result.error ?? result.output,
        });
      }
      continue;
    }

    if (!text) {
      emit(context, { type: "error", message: "Model returned an empty response" });
      break;
    }
    emit(context, { type: "done", executions });
    return;
  }

  emit(context, { type: "done", executions });
}

export async function POST(request: Request) {
  let body: { messages?: unknown[]; attachments?: Array<{ name?: unknown; type?: unknown; size?: unknown; text?: unknown }> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const sourceMessages: ChatLine[] = rawMessages
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) return null;
      const candidate = entry as { role?: unknown; content?: unknown };
      const role = candidate.role;
      const content = typeof candidate.content === "string" ? candidate.content.trim() : "";
      if (role !== "user" && role !== "assistant") return null;
      if (!content) return null;
      return { role, content };
    })
    .filter((entry): entry is ChatLine => entry !== null)
    .slice(-MAX_MESSAGES);

  const attachments = Array.isArray(body.attachments) ? body.attachments : [];

  let contextSnippet = "";
  let total = 0;
  for (const attachment of attachments) {
    if (typeof attachment.text !== "string" || !attachment.text) continue;
    const name = typeof attachment.name === "string" ? attachment.name : "attachment";
    const snippet = attachment.text.length > 4000 ? `${attachment.text.slice(0, 4000)}…` : attachment.text;
    if (total + snippet.length > MAX_CONTEXT_CHARS) break;
    contextSnippet += `\n\n── ${name} ──\n${snippet}`;
    total += snippet.length;
  }
  if (contextSnippet) {
    const last = sourceMessages[sourceMessages.length - 1];
    if (last && last.role === "user") {
      last.content = `${last.content}\n\n[Files provided by the user for context:${contextSnippet}]`;
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const context: StreamContext = { controller };
      void (async () => {
        const lastUser = sourceMessages.filter((message) => message.role === "user").pop();
        let skill: SkillMatch | null = null;
        if (lastUser) {
          try {
            skill = await runSkillIfMatched(lastUser.content);
          } catch {
            skill = null;
          }
          if (skill) {
            emit(context, { type: "meta", available: false, skill: skill.tool, agent: skill.agent ?? agentForTool(skill.tool).name });
            const hash = randomUUID();
            try {
              const { logActivity } = await import("@/lib/activity");
              await logActivity({ actor: "techy", kind: ACTIVITY_KIND[skill.tool] ?? "chat", action: `Skill: ${skill.tool}`, detail: skill.detail || skill.answer.slice(0, 120) });
            } catch {
              // activity is best-effort
            }
            const execution = {
              id: hash,
              toolName: skill.tool,
              status: "completed" as const,
              detail: skill.detail,
              duration: 0,
              completedAt: new Date().toISOString(),
            };
            emit(context, { type: "tool", execution });
            emit(context, { type: "delta", content: skill.answer });
            emit(context, { type: "done", executions: [execution] });
            controller.close();
            return;
          }
        }
        const { getSecurityPolicy } = await import("@/lib/security");
        const policy = await getSecurityPolicy();
        const model = policy.localOnly ? null : await pickModel();
        if (!model) {
          emit(context, { type: "meta", available: false, localOnly: policy.localOnly });
          emit(context, {
            type: "done",
            executions: [],
            message: policy.localOnly
              ? "Local-only mode is enabled in SECURITY. TECHY is running fully offline — no model access. Offline skills keep working for system, files, apps, tasks, memory, calendar, automation and the knowledge base."
              : "No local model detected. Ollama isn't running — TECHY's offline skills are available for system, files, apps, tasks, memory and the knowledge base.",
          });
          controller.close();
          return;
        }
        try {
          await runConversation(context, model, sourceMessages, request.signal);
        } catch (error) {
          emit(context, { type: "error", message: error instanceof Error ? error.message : "Stream failed" });
        } finally {
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}