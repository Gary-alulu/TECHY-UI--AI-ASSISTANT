import { processTranscript } from "@/lib/audio";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { name?: unknown; source?: unknown; transcript?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, { status: 400 });
  }

  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) return jsonResponse(request, { error: "Transcript is required" }, { status: 400 });
  if (transcript.length < 20) return jsonResponse(request, { error: "Transcript is too short to analyze" }, { status: 400 });

  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 120) : "Untitled recording";
  const source = typeof body.source === "string" && body.source.trim() ? body.source.trim().slice(0, 120) : "manual";

  const result = await processTranscript(name, source, transcript);
  return jsonResponse(request, { result }, { status: 201, headers: { "Cache-Control": "no-store" } });
}