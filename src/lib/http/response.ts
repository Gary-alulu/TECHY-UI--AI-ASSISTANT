import { promisify } from "node:util";
import { brotliCompress, gzip } from "node:zlib";

const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

/** Payloads below this size are not worth the CPU cost of compressing. */
const MIN_COMPRESS_BYTES = 512;

interface JsonResponseOptions {
  status?: number;
  headers?: Record<string, string>;
}

/**
 * Serializes a JSON body and compresses it (brotli, then gzip fallback) when the
 * client accepts it and the payload is large enough. A `Vary: Accept-Encoding`
 * header prevents proxies from serving a compressed copy to a client that does
 * not support it. Keeps `Cache-Control: no-store` (passed via headers) intact so
 * live local metrics are never served from a stale copy.
 */
export async function jsonResponse(
  request: Request,
  body: unknown,
  options: JsonResponseOptions = {}
): Promise<Response> {
  const payload = JSON.stringify(body);
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Accept-Encoding",
    ...options.headers,
  };
  const status = options.status ?? 200;

  if (payload.length >= MIN_COMPRESS_BYTES) {
    const acceptEncoding = request.headers.get("accept-encoding") ?? "";
    if (acceptEncoding.includes("br")) {
      const compressed = await brotli(payload);
      headers["Content-Encoding"] = "br";
      return new Response(compressed, { status, headers });
    }
    if (acceptEncoding.includes("gzip")) {
      const compressed = await gzipAsync(payload, { level: 6 });
      headers["Content-Encoding"] = "gzip";
      return new Response(compressed, { status, headers });
    }
  }

  return new Response(payload, { status, headers });
}