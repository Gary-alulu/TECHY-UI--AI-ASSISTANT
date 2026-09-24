import { deleteAudioTranscript, getAudioTranscripts } from "@/lib/audio";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const transcripts = await getAudioTranscripts();
  return jsonResponse(request, { transcripts }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return jsonResponse(request, { error: "Transcript id required" }, { status: 400 });
  const removed = await deleteAudioTranscript(id);
  if (!removed) return jsonResponse(request, { error: "Transcript not found" }, { status: 404 });
  return jsonResponse(request, { ok: true }, { headers: { "Cache-Control": "no-store" } });
}