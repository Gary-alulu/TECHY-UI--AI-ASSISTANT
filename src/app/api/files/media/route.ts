import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveDeviceTarget, resolveSystemTarget, NotFoundError } from "@/lib/system/files";
import { IMAGE_EXTENSIONS } from "@/lib/system/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  svg: "image/svg+xml",
  avif: "image/avif",
  tiff: "image/tiff",
  tif: "image/tiff",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawPath = url.searchParams.get("path") ?? "";
  const scope = url.searchParams.get("scope");
  if (!rawPath) return new Response("Missing path", { status: 400 });

  let target: string;
  try {
    target = scope === "device" ? resolveDeviceTarget(rawPath) : resolveSystemTarget(rawPath);
  } catch {
    return new Response("Path is outside the allowed scope", { status: 400 });
  }

  const extension = path.extname(target).slice(1).toLowerCase();
  if (!extension || !IMAGE_EXTENSIONS.test(target)) {
    return new Response("Not an image", { status: 415 });
  }

  const contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";

  let stat;
  let buffer: Buffer;
  try {
    stat = await fs.stat(target);
    if (stat.size > MAX_IMAGE_BYTES) return new Response("Image too large to preview", { status: 413 });
    buffer = await fs.readFile(target);
  } catch (error) {
    if (error instanceof NotFoundError) return new Response("Not found", { status: 404 });
    return new Response("Could not read file", { status: 500 });
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, max-age=3600",
    },
  });
}