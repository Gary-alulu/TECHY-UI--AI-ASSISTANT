import { promises as fs } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { NotFoundError } from "./files";

type PDFParseResult = string | { text?: string; pages?: unknown[]; total?: number };
type PDFParseInstance = {
  getText: () => Promise<PDFParseResult>;
  getInfo?: () => Promise<Record<string, unknown>>;
  destroy?: () => void;
};
type PDFParseConstructor = new (options: { data: Buffer; useSystemFonts?: boolean }) => PDFParseInstance;

function loadPDFParse(): PDFParseConstructor {
  const libName = String.fromCharCode(112, 100, 102, 45, 112, 97, 114, 115, 101);
  const anchor = path.join(process.cwd(), "node_modules", ".techy-pdf-parse.js");
  const require = createRequire(anchor);
  const pdfParseModule = require(libName) as { PDFParse?: PDFParseConstructor };
  return pdfParseModule.PDFParse ?? (pdfParseModule as unknown as PDFParseConstructor);
}

function pdfResultText(result: PDFParseResult): string {
  const raw = typeof result === "string" ? result : result.text ?? "";
  return raw.replace(/\n*-- \d+ of \d+ --\s*/g, "\n");
}

export type DocumentKind =
  | "text"
  | "code"
  | "markdown"
  | "json"
  | "csv"
  | "pdf"
  | "docx"
  | "xlsx"
  | "image"
  | "presentation"
  | "archive"
  | "binary";

const MAX_DOC_CHARS = 200_000;

export const TEXT_EXTENSIONS =
  /\.(txt|log|env|ini|cfg|conf|ts|tsx|js|jsx|mjs|cjs|css|scss|html|htm|xml|py|go|rs|java|c|cpp|h|hpp|sh|bash|sql|yml|yaml|toml|md|markdown|mdx|json|csv|svg|gradle|properties|abap|r|rb|php|swift|kt|cs|vue|svelte)$/i;

export const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|bmp|ico|svg|avif|tiff|tif)$/i;

export function classifyFile(name: string): { kind: DocumentKind; extension?: string } {
  const extension = path.extname(name).slice(1).toLowerCase();
  if (!extension) return { kind: "binary" };
  const ext = extension;
  switch (ext) {
    case "md":
    case "markdown":
    case "mdx":
      return { kind: "markdown", extension: ext };
    case "json":
      return { kind: "json", extension: ext };
    case "csv":
      return { kind: "csv", extension: ext };
    case "pdf":
      return { kind: "pdf", extension: ext };
    case "docx":
      return { kind: "docx", extension: ext };
    case "xlsx":
    case "xlsm":
      return { kind: "xlsx", extension: ext };
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
    case "css":
    case "html":
    case "htm":
    case "py":
    case "go":
    case "rs":
    case "java":
    case "c":
    case "cpp":
    case "h":
    case "hpp":
    case "sh":
    case "sql":
    case "xml":
    case "yml":
    case "yaml":
    case "toml":
    case "ini":
    case "env":
    case "config":
      return { kind: "code", extension: ext };
    case "ppt":
    case "pptx":
      return { kind: "presentation", extension: ext };
    case "zip":
    case "rar":
    case "7z":
    case "tar":
    case "gz":
    case "bz2":
      return { kind: "archive", extension: ext };
    default:
      if (IMAGE_EXTENSIONS.test(name)) return { kind: "image", extension: ext };
      if (TEXT_EXTENSIONS.test(name)) return { kind: "text", extension: ext };
      return { kind: "binary", extension: ext };
  }
}

function prettifyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/**
 * Extracts readable text from a local document. Capped to MAX_DOC_CHARS.
 * Returns `note` when the format is present but text extraction is unavailable.
 */
export async function extractText(filePath: string): Promise<{ text: string; note?: string }> {
  const name = path.basename(filePath);
  const { kind } = classifyFile(name);

  try {
    if (kind === "pdf") {
      try {
        const buffer = await fs.readFile(filePath);
        const PDFParse = loadPDFParse();
        const instance = new PDFParse({ data: buffer, useSystemFonts: true });
        try {
          return { text: pdfResultText(await instance.getText()) };
        } finally {
          instance.destroy?.();
        }
      } catch (error) {
        return { text: "", note: `PDF text extraction failed: ${error instanceof Error ? error.message : "unknown error"}` };
      }
    }
    if (kind === "docx") {
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return { text: result.value ?? "" };
    }
    if (kind === "xlsx") {
      const buffer = await fs.readFile(filePath);
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheets = workbook.SheetNames.slice(0, 24);
      const parts: string[] = [];
      for (const sheetName of sheets) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const csv = XLSX.utils.sheet_to_csv(sheet, { FS: "\t" });
        parts.push(`── Sheet: ${sheetName} ──\n${csv}`);
      }
      return { text: parts.join("\n\n") };
    }
    if (kind === "json") {
      const raw = await fs.readFile(filePath, "utf8");
      return { text: prettifyJson(raw) };
    }
    if (kind === "text" || kind === "code" || kind === "markdown" || kind === "csv") {
      return { text: await fs.readFile(filePath, "utf8") };
    }
    if (kind === "image") {
      return { text: "", note: "Image content requires a vision model to read — metadata is available." };
    }
    if (kind === "presentation") {
      return { text: "", note: "Presentation slide text extraction isn't available yet." };
    }
    if (kind === "archive") {
      return { text: "", note: "Archive listing isn't available yet." };
    }
    return { text: "", note: "Binary or unknown file — no text preview." };
  } catch (error) {
    return {
      text: "",
      note: `Could not extract text: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

export interface DocumentPreview {
  kind: DocumentKind;
  name: string;
  size: number;
  extension?: string;
  modifiedAt?: string;
  text?: string;
  truncated?: boolean;
  note?: string;
}

export async function buildPreview(filePath: string): Promise<DocumentPreview> {
  const name = path.basename(filePath);
  const { kind, extension } = classifyFile(name);
  let stat: Awaited<ReturnType<typeof fs.stat>> | null = null;
  try {
    stat = await fs.stat(filePath);
  } catch {
    throw new NotFoundError("File not found");
  }

  const base: DocumentPreview = {
    kind,
    name,
    size: stat?.size ?? 0,
    ...(extension ? { extension } : {}),
    ...(stat?.mtime ? { modifiedAt: stat.mtime.toISOString() } : {}),
  };

  if (kind === "image") {
    base.note = "Preview rendered from the original file. Full understanding needs a vision model.";
    return base;
  }

  const { text, note } = await extractText(filePath);
  if (text.length > MAX_DOC_CHARS) {
    base.text = text.slice(0, MAX_DOC_CHARS);
    base.truncated = true;
  } else {
    base.text = text;
  }
  if (note) base.note = note;
  return base;
}

export function isImageKind(kind: DocumentKind): boolean {
  return kind === "image";
}