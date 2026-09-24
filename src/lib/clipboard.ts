export type ClipboardKind = "url" | "email" | "phone" | "address" | "code" | "table" | "image" | "plain";

export type ClipboardAction =
  | "summarize"
  | "explain"
  | "rewrite"
  | "improve"
  | "translate"
  | "save"
  | "draft reply"
  | "format code"
  | "to markdown"
  | "analyze";

export interface ClipboardIntel {
  kind: ClipboardKind;
  label: string;
  detected: {
    urls?: string[];
    emails?: string[];
    phones?: string[];
    address?: boolean;
    image?: boolean;
    codeLanguage?: string | null;
    codeLines?: number;
    rows?: number;
    columns?: number;
    json?: boolean;
  };
  actions: ClipboardAction[];
  preview: string;
  charCount: number;
  wordCount: number;
  sample: string;
}

const URL_RE = /https?:\/\/[^\s<>"']+/gi;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /(?:(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{3,4}[\s.-]?\d{3,4})(?!\d)/g;
const ADDRESS_MARKERS = /(street|st\.?|avenue|ave\.?|boulevard|blvd\.?|road|rd\.?|lane|ln\.?|drive|dr\.?|way|court|ct\.?|place|pl\.?|close|terrace|ter\.?|highway|hwy\.?|high ?street)/i;
const CODE_KEYWORDS = /\b(import|from|export|const|let|var|function|=>|def |class |return|console\.log|public static|using |package |#include|fn |impl )\b/;
const CODE_BRACE = /[{};]/;

const KIND_LABELS: Record<ClipboardKind, string> = {
  url: "URL",
  email: "Email",
  phone: "Phone number",
  address: "Address",
  code: "Code",
  table: "Table / structured data",
  image: "Image",
  plain: "Plain text",
};

const COMMON_ACTIONS: ClipboardAction[] = ["summarize", "explain", "improve"];
const TEXT_ACTIONS: ClipboardAction[] = ["rewrite", "translate"];

function detectCode(text: string): { language: string | null; json: boolean; lines: number } | null {
  const candidates = text.match(/```(\w+)?/g);
  if (candidates && candidates.length >= 2) {
    const language = text.match(/```(\w+)/)?.[1] ?? null;
    return { language, json: false, lines: text.split("\n").length };
  }
  const trimmed = text.trim();
  let json = false;
  try {
    JSON.parse(trimmed);
    json = true;
  } catch {
    json = false;
  }
  if (json) return { language: "json", json: true, lines: trimmed.split("\n").length };
  if (/^[a-z0-9-]+\s*\.(js|ts|tsx|jsx|py|c|cs|go|rs|java|php|rb|sh|ps1|css|scss|html|yml|yaml|json|md)\s*$/im.test(trimmed)) return null;
  if (/(^\s*(function|const|let|var|class|import|export|def|fn)\b|\{\s*\n|=>\s*\{)/m.test(trimmed) && CODE_BRACE.test(trimmed)) {
    const language = CODE_KEYWORDS.test(trimmed)
      ? trimmed.includes("import ") || trimmed.includes("export ") || trimmed.includes("=>")
        ? "typescript/javascript"
        : "code"
      : "code";
    return { language, json: false, lines: trimmed.split("\n").length };
  }
  if (CODE_KEYWORDS.test(trimmed)) {
    return { language: "code", json: false, lines: trimmed.split("\n").length };
  }
  const hexColors = trimmed.match(/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?(?:\s|$)/);
  if (hexColors && /[{;:]/.test(trimmed)) return { language: "css", json: false, lines: trimmed.split("\n").length };
  return null;
}

function detectTable(text: string): { rows: number; columns: number } | null {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return null;
  for (const separator of ["\t", ",", "|", ";", "  "]) {
    const counts = lines.slice(0, 8).map((line) => line.split(separator).length);
    const first = counts[0];
    if (first >= 2 && counts.every((count) => Math.abs(count - first) <= 1)) {
      const sample = lines.slice(0, 4).join("\n");
      if (separator !== "," || /\d/.test(sample.replace(/,/g, ""))) return { rows: lines.length, columns: first };
    }
  }
  return null;
}

function detectKind(text: string): { kind: ClipboardKind; detected: ClipboardIntel["detected"] } {
  const trimmed = text.trim();
  if (!trimmed.endsWith("=") && /^data:image\//i.test(trimmed)) {
    return { kind: "image", detected: { image: true } };
  }

  const urls = trimmed.match(/^https?:\/\/\S+$/i) ? [...(trimmed.match(URL_RE) ?? [])] : [];
  if (urls.length > 0 && trimmed.split(/\s+/).length <= 3) {
    return { kind: "url", detected: { urls } };
  }

  const emails = [...(trimmed.match(EMAIL_RE) ?? [])];
  if (emails.length > 0 && emails.length === trimmed.split(/[\s;,]+/).filter(Boolean).length) {
    return { kind: "email", detected: { emails } };
  }

  const phones = [...(trimmed.match(PHONE_RE) ?? [])];
  if (phones.length > 0 && trimmed.replace(/\D/g, "").length >= 7 && trimmed.split(/\s+/).length <= 3) {
    return { kind: "phone", detected: { phones } };
  }

  const address = ADDRESS_MARKERS.test(trimmed) && /[0-9]/.test(trimmed) && /\s{2,}|,\s*[A-Z]{2}\b|\b\d{5}(-\d{4})?\b/.test(trimmed);
  if (address) return { kind: "address", detected: { address: true } };

  const code = detectCode(trimmed);
  if (code) {
    return {
      kind: "code",
      detected: { codeLanguage: code.language, codeLines: code.lines, json: code.json },
    };
  }

  const table = detectTable(trimmed);
  if (table) return { kind: "table", detected: { rows: table.rows, columns: table.columns } };

  const allUrls = [...(trimmed.match(URL_RE) ?? [])];
  const allEmails = [...(trimmed.match(EMAIL_RE) ?? [])];
  const allPhones = [...(trimmed.match(PHONE_RE) ?? [])];
  return {
    kind: "plain",
    detected: {
      ...(allUrls.length > 0 ? { urls: allUrls } : {}),
      ...(allEmails.length > 0 ? { emails: allEmails } : {}),
      ...(allPhones.length > 0 ? { phones: allPhones } : {}),
    },
  };
}

function actionsFor(kind: ClipboardKind): ClipboardAction[] {
  const actions = [...COMMON_ACTIONS];
  if (kind === "code") {
    actions.push("format code", "translate");
    return actions;
  }
  if (kind === "table") {
    actions.push("analyze", "to markdown");
    return actions;
  }
  if (kind === "email") {
    actions.push("draft reply", "rewrite", "translate");
    return actions;
  }
  if (kind === "url") {
    actions.push("rewrite", "translate");
    return actions;
  }
  actions.push(...TEXT_ACTIONS);
  return actions;
}

export function classifyClipboard(rawText: string, scan?: { maxChars?: number }): ClipboardIntel {
  const text = (rawText ?? "").trim();
  const maxChars = scan?.maxChars ?? 20_000;
  const clipped = text.slice(0, maxChars);
  const { kind, detected } = detectKind(clipped);
  const preview = clipped.length > 320 ? `${clipped.slice(0, 320)}…` : clipped;
  const wordCount = clipped.split(/\s+/).filter(Boolean).length;

  return {
    kind,
    label: KIND_LABELS[kind],
    detected,
    actions: actionsFor(kind),
    preview,
    charCount: clipped.length,
    wordCount,
    sample: clipped,
  };
}

export function describeDetection(intel: ClipboardIntel): string {
  const parts: string[] = [];
  const detected = intel.detected;
  if (detected.urls?.length) parts.push(`${detected.urls.length} URL${detected.urls.length > 1 ? "s" : ""}`);
  if (detected.emails?.length) parts.push(`${detected.emails.length} address${detected.emails.length > 1 ? "es" : ""}`);
  if (detected.phones?.length) parts.push(`${detected.phones.length} phone number${detected.phones.length > 1 ? "s" : ""}`);
  if (detected.address) parts.push("a physical address");
  if (detected.codeLanguage) parts.push(`code (${detected.codeLanguage}${detected.codeLines ? `, ${detected.codeLines} lines` : ""})`);
  if (detected.json) parts.push("parseable JSON");
  if (detected.rows) parts.push(`a ${detected.rows}×${detected.columns ?? "?"} table`);
  if (detected.image) parts.push("an inline image");
  if (parts.length === 0) parts.push(`${intel.wordCount}-word ${intel.label.toLowerCase()} snippet`);
  return `Detected ${parts.join(" · ")}.`;
}

export function fingerprintClipboard(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 256);
}

const WORD_SPLIT = /[.!?\n]+/;
const FILLER = /\b(the|a|an|and|or|but|of|to|in|on|for|with|at|by|from|is|are|was|were|it|its|this|that|these|those|i|we|you|they|he|she)\b/gi;

function splitSentences(text: string): string[] {
  return text
    .split(WORD_SPLIT)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length > 8);
}

function simpleSummary(text: string): string {
  const sentences = splitSentences(text);
  if (sentences.length <= 1) return text.slice(0, 500);
  const target = Math.max(1, Math.min(3, Math.ceil(sentences.length / 3)));
  const scored = sentences.map((sentence, index) => ({
    sentence,
    score: sentence.startsWith(sentence[0]?.toUpperCase()) && !sentence.startsWith("The ") && !sentence.startsWith("A ") && !sentence.startsWith("An ") && !sentence.startsWith("This ")
      ? 3 + (FILLER.test(sentence) ? 1 : 0)
      : 1,
    index,
  }));
  scored[0].score += 2;
  const chosen = scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, target)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.sentence);
  return chosen.join(" ");
}

function normalizeText(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences
    .map((sentence) => {
      const trimmed = sentence.trim();
      if (!trimmed) return "";
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).replace(/[ \t]{2,}/g, " ");
    })
    .filter(Boolean)
    .join(" ");
}

function tableToMarkdown(text: string): string {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  for (const separator of ["\t", ",", "|", ";", "  "]) {
    const split = (line: string) => {
      if (separator === "  ") return line.split(/\s{2,}/).map((cell) => cell.trim());
      return line.split(separator).map((cell) => cell.trim().replace(/\s+/g, " "));
    };
    const rows = lines.slice(0, 50).map(split);
    const first = rows[0]?.length ?? 0;
    if (first >= 2 && rows.every((row) => Math.abs(row.length - first) <= 1)) {
      const header = rows[0];
      const body = rows.slice(1).filter((row) => row.length === first);
      const align = header.map(() => "---");
      return [
        `${header.map((value) => `| ${value} `).join("")}|`,
        `${align.map((value) => `| ${value} `).join("")}|`,
        ...body.map((row) => `${row.map((value) => `| ${value} `).join("")}|`),
      ].join("\n");
    }
  }
  return "```csv\n" + text.slice(0, 2000) + "\n```";
}

function formatCode(text: string): string {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed);
    return JSON.stringify(parsed, null, 2);
  } catch {
    let depth = 0;
    let out = "";
    for (const character of trimmed) {
      if (character === "{" || character === "[") {
        out += character + "\n" + "  ".repeat(++depth);
      } else if (character === "}" || character === "]") {
        out += "\n" + "  ".repeat(--depth < 0 ? 0 : depth) + character;
      } else if (character === ";") {
        out += character + "\n" + "  ".repeat(depth);
      } else {
        out += character;
        if (character === "\n") out += "  ".repeat(depth);
      }
    }
    return out;
  }
}

export interface OfflineActionInput {
  action: ClipboardAction;
  intel: ClipboardIntel;
}

export interface OfflineActionResult {
  reply: string | null;
  offline: boolean;
}

export function runOfflineAction({ action, intel }: OfflineActionInput): OfflineActionResult {
  const text = intel.sample;
  switch (action) {
    case "summarize":
      return { reply: simpleSummary(text), offline: true };
    case "improve":
    case "rewrite":
      return { reply: normalizeText(text), offline: true };
    case "to markdown":
      return { reply: tableToMarkdown(text), offline: true };
    case "format code":
      return { reply: formatCode(text), offline: true };
    case "save":
      return { reply: null, offline: true };
    default:
      return { reply: null, offline: true };
  }
}

export function clipToPayload(text: string, maxChars = 12_000): string {
  const trimmed = (text ?? "").trim();
  return trimmed.length > maxChars ? trimmed.slice(0, maxChars) : trimmed;
}