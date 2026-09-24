import { askLocalModel } from "@/lib/ai/ollama";
import {
  classifyClipboard,
  clipToPayload,
  runOfflineAction,
  type ClipboardAction,
  type ClipboardIntel,
} from "@/lib/clipboard";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTION_LABELS: Partial<Record<ClipboardAction, string>> = {
  summarize: "Summarize the following content clearly and concisely, in a few sentences.",
  explain: "Explain the following content in plain language the user can understand.",
  rewrite: "Rewrite the following content with fresh wording while keeping the meaning identical.",
  improve: "Improve the following content: fix grammar, tighten the writing and make it read better.",
  translate: "Translate the following content into the same language the user has been using (default English unless the content is in another language — then translate into that).",
  "draft reply": "Draft a polite, concise reply to this message or email. Output only the draft.",
  analyze: "Analyze the following structured data: summarize trends, totals, outliers and anything worth flagging.",
};

const VALID_ACTIONS = new Set<ClipboardAction>([
  "summarize",
  "explain",
  "rewrite",
  "improve",
  "translate",
  "draft reply",
  "analyze",
  "format code",
  "to markdown",
]);

export async function POST(request: Request) {
  let body: { text?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, { status: 400 });
  }

  const rawText = typeof body.text === "string" ? body.text : "";
  const action = typeof body.action === "string" ? (body.action as ClipboardAction) : "";
  if (!rawText.trim()) return jsonResponse(request, { error: "text is required" }, { status: 400 });
  if (!action || !VALID_ACTIONS.has(action)) {
    return jsonResponse(request, { error: "unknown action" }, { status: 400 });
  }

  const text = clipToPayload(rawText);
  const intel: ClipboardIntel = classifyClipboard(text);

  const offline = runOfflineAction({ action, intel });
  if (offline.reply !== null) {
    return jsonResponse(request, { available: true, offline: true, action, kind: intel.kind, reply: offline.reply }, { headers: { "Cache-Control": "no-store" } });
  }

  const label = ACTION_LABELS[action];
  if (!label) {
    return jsonResponse(request, { available: false, offline: true, action, kind: intel.kind, reply: null }, { headers: { "Cache-Control": "no-store" } });
  }

  const reply = await askLocalModel(
    [{ role: "user", content: `${label}\n\n${text}` }],
    { system: "You are TECHY, a local-first AI assistant. Follow the task strictly and output only the requested result." }
  );

  if (reply !== null) {
    return jsonResponse(request, { available: true, offline: false, action, kind: intel.kind, reply }, { headers: { "Cache-Control": "no-store" } });
  }

  return jsonResponse(request, { available: false, offline: true, action, kind: intel.kind, reply: null }, { headers: { "Cache-Control": "no-store" } });
}