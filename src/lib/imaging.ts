import { promises as fs } from "node:fs";
import { inflateSync } from "node:zlib";
import path from "node:path";
import type { Dirent } from "node:fs";
import { WORKSPACE_ROOT } from "@/lib/system/files";
import type { ImageInspection } from "@/types";

const IMAGE_EXTS = /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i;

interface RawImage {
  format: "png" | "jpg" | "other";
  width: number;
  height: number;
  bitDepth?: number;
  colorMode?: string;
  palette: Array<{ hex: string; share: number }>;
}

function dominantColors(sample: Array<{ r: number; g: number; b: number }>): Array<{ hex: string; share: number }> {
  const buckets = new Map<string, { rgb: [number, number, number]; hits: number }>();
  for (const pixel of sample) {
    const key = `${pixel.r >> 4},${pixel.g >> 4},${pixel.b >> 4}`;
    const existing = buckets.get(key);
    if (existing) existing.hits += 1;
    else buckets.set(key, { rgb: [pixel.r, pixel.g, pixel.b], hits: 1 });
  }
  const total = sample.length || 1;
  return [...buckets.values()]
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 6)
    .map(({ rgb, hits }) => ({
      hex: `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`,
      share: Math.round((hits / total) * 100),
    }));
}

/** Parses the PNG signature, IHDR and (for pixel sampling) the IDAT streams. */
function parsePng(data: Buffer): RawImage {
  if (data.length < 33 || data.readUInt32BE(0) !== 0x89504e47 || data.readUInt32BE(4) !== 0x0d0a1a0a) {
    throw new Error("Not a PNG file");
  }
  if (data.readUInt32BE(12) !== 0x49484452) throw new Error("PNG missing IHDR");
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  const bitDepth = data.readUInt8(24);
  const colorType = data.readUInt8(25);

  let palette: Array<{ hex: string; share: number }> = [];
  try {
    const idat = Buffer.concat(collectChunks(data, "IDAT"));
    const inflated = inflateSync(idat);
    const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
    const stride = width * bytesPerPixel;
    const sampled: Array<{ r: number; g: number; b: number }> = [];
    const step = Math.max(2, Math.floor(height / 48));
    const paeth = colorType === 6 || colorType === 2;

    const prev = new Uint8Array(stride);
    for (let y = 0; y < height && y < inflated.length / stride; y += step) {
      const filter = inflated[y * (stride + 1)];
      const rowStart = y * (stride + 1) + 1;
      if (rowStart + stride > inflated.length) break;
      const row = Buffer.from(inflated.slice(rowStart, rowStart + stride));
      if (paeth && filter !== 0) {
        for (let x = 0; x < stride; x++) {
          const a = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
          const b = prev[x];
          const c = x >= bytesPerPixel ? prev[x - bytesPerPixel] : 0;
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          row[x] = (row[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
        }
      } else if (filter === 1) {
        for (let x = bytesPerPixel; x < stride; x++) row[x] = (row[x] + row[x - bytesPerPixel]) & 0xff;
      } else if (filter === 2) {
        for (let x = 0; x < stride; x++) row[x] = (row[x] + prev[x]) & 0xff;
      } else if (filter === 4) {
        for (let x = 0; x < stride; x++) {
          const a = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
          row[x] = (row[x] + ((a + prev[x]) >> 1)) & 0xff;
        }
      }
      prev.set(row);
      for (let x = 0; x < stride; x += bytesPerPixel * 4) {
        const r = row[x];
        const g = bytesPerPixel >= 2 ? row[x + 1] : r;
        const b = bytesPerPixel >= 3 ? row[x + 2] : r;
        sampled.push({ r, g, b });
      }
    }
    palette = dominantColors(sampled);
  } catch {
    palette = [];
  }

  return {
    format: "png",
    width,
    height,
    bitDepth,
    colorMode: colorType === 6 ? "RGBA" : colorType === 2 ? "RGB" : colorType === 3 ? "Palette" : colorType === 4 ? "Gray+Alpha" : "Gray",
    palette,
  };
}

function collectChunks(data: Buffer, type: string): Buffer[] {
  let offset = 8;
  const out: Buffer[] = [];
  while (offset + 12 <= data.length) {
    const length = data.readUInt32BE(offset);
    const chunkType = data.toString("ascii", offset + 4, offset + 8);
    const body = data.subarray(offset + 8, offset + 8 + Math.min(length, data.length - offset - 12));
    const crcLength = offset + 8 + body.length;
    if (crcLength + 4 > data.length) break;
    if (chunkType === type) out.push(Buffer.from(body));
    if (chunkType === "IEND") break;
    offset = crcLength + 4;
  }
  return out;
}

/** Parses JPEG SOF segments for dimensions/components. */
function parseJpeg(data: Buffer): RawImage {
  let offset = 2;
  let width = 0;
  let height = 0;
  let precision = 0;
  let components = 0;
  while (offset + 4 <= data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = data[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      precision = data[offset + 4];
      height = data.readUInt16BE(offset + 5);
      width = data.readUInt16BE(offset + 7);
      components = data[offset + 9];
      break;
    }
    const length = data.readUInt16BE(offset + 2);
    offset += 2 + length;
  }
  if (!width || !height) throw new Error("JPEG dimensions not found");
  return { format: "jpg", width, height, bitDepth: precision, colorMode: components === 4 ? "CMYK" : components === 3 ? "RGB" : "Grayscale", palette: [] };
}

export async function inspectImage(absolutePath: string): Promise<ImageInspection> {
  const raw = await fs.readFile(absolutePath);
  const name = path.basename(absolutePath);
  const parsed: RawImage = raw.readUInt32BE(0) === 0x89504e47 ? parsePng(raw) : raw[0] === 0xff && raw[1] === 0xd8 ? parseJpeg(raw) : { format: "other", width: 0, height: 0, palette: [] };

  const ppiEquivalent = 72;
  const maxWidthCm = parsed.width > 0 ? Math.round((parsed.width / 300) * 2.54) : 0;
  const maxHeightCm = parsed.height > 0 ? Math.round((parsed.height / 300) * 2.54) : 0;
  const qualifies = maxWidthCm >= 40;

  return {
    path: absolutePath,
    name,
    format: parsed.format,
    width: parsed.width,
    height: parsed.height,
    bitDepth: parsed.bitDepth,
    colorMode: parsed.colorMode,
    bytes: raw.length,
    palette: parsed.palette,
    printInfo: parsed.width > 0 && parsed.height > 0 ? { ppiEquivalent, maxWidthCm, maxHeightCm, qualifies } : undefined,
  };
}

export async function listWorkspaceImages(): Promise<Array<{ path: string; name: string; size: number }>> {
  const out: Array<{ path: string; name: string; size: number }> = [];
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > 4) return;
    let entries: Dirent[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".next") continue;
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
      } else if (entry.isFile() && IMAGE_EXTS.test(entry.name)) {
        try {
          const stat = await fs.stat(full);
          out.push({ path: full, name: path.relative(WORKSPACE_ROOT, full), size: stat.size });
        } catch {
          // unreadable
        }
      }
    }
  };
  await walk(WORKSPACE_ROOT, 0);
  return out.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 60);
}