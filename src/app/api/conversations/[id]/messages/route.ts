import { appendMessage } from "@/lib/conversations";
import { jsonResponse } from "@/lib/http/response";
import type { FileAttachment, ToolExecution } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES: Array<"user" | "assistant"> = ["user", "assistant"];

function isFileAttachment(value: unknown): value is FileAttachment {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.size === "number"
  );
}

function isToolExecution(value: unknown): value is ToolExecution {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.toolName === "string" &&
    typeof candidate.status === "string" &&
    (candidate.output === undefined || typeof candidate.output === "string") &&
    (candidate.error === undefined || typeof candidate.error === "string")
  );
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  let body: { content?: unknown; role?: unknown; attachments?: unknown; toolExecution?: unknown; toolExecutions?: unknown; replaceLast?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return jsonResponse(request, { error: "Message content is required" }, { status: 400 });
  if (content.length > 4000) return jsonResponse(request, { error: "Message too long (4000 character limit)" }, { status: 400 });

  const role = ALLOWED_ROLES.includes(body.role as "user" | "assistant") ? (body.role as "user" | "assistant") : "user";

  const attachments = Array.isArray(body.attachments)
    ? body.attachments.filter(isFileAttachment).slice(0, 8)
    : undefined;

  const toolExecutions = Array.isArray(body.toolExecutions)
    ? body.toolExecutions.filter(isToolExecution).slice(0, 12)
    : undefined;

  const toolExecution = isToolExecution(body.toolExecution) ? body.toolExecution : undefined;

  const result = await appendMessage(id, {
    role,
    content,
    attachments,
    toolExecution,
    toolExecutions,
    replaceLast: body.replaceLast === true,
  });
  if (!result) return jsonResponse(request, { error: "Conversation not found" }, { status: 404 });

  return jsonResponse(request, { message: result.message, conversation: result.conversation }, { status: 201, headers: { "Cache-Control": "no-store" } });
}