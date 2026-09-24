import { classifyClipboard, type ClipboardIntel } from "@/lib/clipboard";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { text?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) {
    return jsonResponse(request, { error: "text is required" }, { status: 400 });
  }

  const intel: ClipboardIntel = classifyClipboard(text);
  return jsonResponse(request, intel, { headers: { "Cache-Control": "no-store" } });
}