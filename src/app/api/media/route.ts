import { listMedia, mediaIsPlayable } from "@/lib/media";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path");

  if (path) {
    const info = await mediaIsPlayable(path);
    return jsonResponse(request, { ok: info.ok, kind: info.kind, error: info.error }, { headers: { "Cache-Control": "no-store" } });
  }

  const media = await listMedia();
  const counts = { music: 0, video: 0, podcast: 0, audio: 0 } as Record<string, number>;
  let totalBytes = 0;
  for (const entry of media) {
    counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;
    totalBytes += entry.sizeBytes;
  }
  return jsonResponse(request, { media, counts, totalBytes }, { headers: { "Cache-Control": "no-store" } });
}