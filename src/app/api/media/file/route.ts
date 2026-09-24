import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import { safeMediaFile } from "@/lib/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".opus": "audio/ogg",
  ".aiff": "audio/aiff",
  ".wma": "audio/x-ms-wma",
  ".mp4": "video/mp4",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".avi": "video/x-msvideo",
  ".flv": "video/x-flv",
  ".wmv": "video/x-ms-wmv",
  ".m4v": "video/mp4",
};

async function streamRange(filePath: string, request: Request): Promise<Response> {
  const stat = await fs.stat(filePath);
  const total = stat.size;
  const ext = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
  const range = request.headers.get("range");

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match && match[1] ? Number(match[1]) : 0;
    const end = match && match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
    if (match && start < total && start <= end) {
      headers["Content-Range"] = `bytes ${start}-${end}/${total}`;
      headers["Content-Length"] = String(end - start + 1);
      const stream = createReadStream(filePath, { start, end });
      return new Response(stream as unknown as BodyInit, { status: 206, headers });
    }
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
  }

  headers["Content-Length"] = String(total);
  const stream = createReadStream(filePath);
  return new Response(stream as unknown as BodyInit, { status: 200, headers });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = url.searchParams.get("path");
  if (!target) return new Response("Missing path", { status: 400 });

  const { path: filePath, error } = await safeMediaFile(target);
  if (error) return new Response(error, { status: 415 });

  try {
    return await streamRange(filePath, request);
  } catch {
    return new Response("File not found", { status: 404 });
  }
}