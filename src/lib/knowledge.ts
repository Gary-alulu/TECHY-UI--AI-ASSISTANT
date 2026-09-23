import { promises as fs } from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "@/lib/system/files";
import { TEXT_EXTENSIONS } from "@/lib/system/documents";

const INDEX_TTL_MS = 60_000;
const MAX_INDEX_FILES = 800;
const MAX_INDEX_BYTES = 8 * 1024 * 1024;
const MAX_FILE_BYTES = 512 * 1024;
const SNIPPET_RADIUS = 140;

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "public",
  "src",
  "dist",
  "build",
  "data",
  "$Recycle.Bin",
  "System Volume Information",
  "Windows",
  "AppData",
]);

const SKIP_FILES = /(package-lock\.json$|yarn\.lock$|pnpm-lock\.yaml$|\.map$|\.lock$|\.png$|\.jpe?g$|\.gif$|\.webp$|\.ico$|\.svg$|\.log$)/i;

export interface KnowledgeDocument {
  path: string;
  name: string;
  text: string;
}

export interface KnowledgeIndex {
  documents: KnowledgeDocument[];
  builtAt: number;
  bytes: number;
}

export interface KnowledgeHit {
  path: string;
  name: string;
  score: number;
  terms: string[];
  snippet: string;
  size: number;
}

let cachedIndex: Promise<KnowledgeIndex> | null = null;
let cachedAt = 0;

async function collectDocuments(dir: string, root: string, output: KnowledgeDocument[], bytes: { used: number }): Promise<void> {
  let entries: Array<{ name: string; isDirectory: boolean; isSymbolicLink: boolean }>;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true }).then((list) =>
      list.map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory(), isSymbolicLink: entry.isSymbolicLink() }))
    );
  } catch {
    return;
  }

  for (const entry of entries) {
    if (output.length >= MAX_INDEX_FILES || bytes.used >= MAX_INDEX_BYTES) return;
    if (entry.isDirectory) {
      if (SKIP_DIRS.has(entry.name) || (entry.name.startsWith(".") && dir !== root)) continue;
      await collectDocuments(path.join(dir, entry.name), root, output, bytes);
      continue;
    }
    if (entry.isSymbolicLink) continue;
    if (!TEXT_EXTENSIONS.test(entry.name) || SKIP_FILES.test(entry.name)) continue;

    const full = path.join(dir, entry.name);
    try {
      const stat = await fs.stat(full);
      if (stat.size > MAX_FILE_BYTES) continue;
      const text = await fs.readFile(full, "utf8");
      const trimmed = text.slice(0, MAX_FILE_BYTES);
      output.push({ path: full, name: entry.name, text: trimmed });
      bytes.used += Math.min(stat.size, trimmed.length);
    } catch {
      // unreadable files are skipped
    }
  }
}

export async function buildKnowledgeIndex(force = false): Promise<KnowledgeIndex> {
  if (!force && cachedIndex && Date.now() - cachedAt < INDEX_TTL_MS) return cachedIndex;
  const documents: KnowledgeDocument[] = [];
  const bytes = { used: 0 };
  await collectDocuments(WORKSPACE_ROOT, WORKSPACE_ROOT, documents, bytes);
  const fixtures = path.join(WORKSPACE_ROOT, "data", "fixtures");
  if (await exists(fixtures)) await collectDocuments(fixtures, fixtures, documents, bytes);
  const index: KnowledgeIndex = { documents, builtAt: Date.now(), bytes: bytes.used };
  cachedIndex = Promise.resolve(index);
  cachedAt = index.builtAt;
  return cachedIndex;
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 2 && token.length <= 40);
}

function termFrequencies(text: string, terms: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  const lower = text.toLowerCase();
  for (const term of terms) {
    let start = 0;
    let found = 0;
    for (;;) {
      const index = lower.indexOf(term, start);
      if (index === -1) break;
      found += 1;
      start = index + term.length;
    }
    counts.set(term, found);
  }
  return counts;
}

function idf(docCount: number, docsWithTerm: number): number {
  return Math.log(1 + (docCount - docsWithTerm + 0.5) / (docsWithTerm + 0.5));
}

export function searchKnowledge(query: string, limit = 8): Promise<{ hits: KnowledgeHit[]; indexed: { files: number; bytes: number; builtAt: number } }> {
  return (async () => {
    const index = await buildKnowledgeIndex();
    const terms = tokenize(query);
    const needle = query.toLowerCase();
    if (terms.length === 0) return { hits: [], indexed: { files: index.documents.length, bytes: index.bytes, builtAt: index.builtAt } };

    const docCount = index.documents.length;
    const docsWithTerm = new Map<string, number>();
    for (const doc of index.documents) {
      const lower = doc.text.toLowerCase();
      for (const term of terms) {
        if (lower.includes(term)) docsWithTerm.set(term, (docsWithTerm.get(term) ?? 0) + 1);
      }
    }

    const rows: Array<{ doc: KnowledgeDocument; score: number; terms: string[]; snippet: string }> = [];
    for (const doc of index.documents) {
      const lower = doc.text.toLowerCase();
      const worn = terms.filter((term) => lower.includes(term));
      if (worn.length === 0) continue;

      let score = 0;
      let firstIndex = Number.MAX_SAFE_INTEGER;
      for (const term of worn) {
        const tf = termFrequencies(lower, [term]).get(term) ?? 0;
        const w = idf(docCount, docsWithTerm.get(term) ?? 0);
        score += (tf > 0 ? 1 + Math.log(tf) : 0) * w;
        const indexOf = lower.indexOf(term);
        if (indexOf !== -1 && indexOf < firstIndex) firstIndex = indexOf;
      }
      const nameLower = doc.name.toLowerCase();
      const titleHasTerm = worn.some((term) => nameLower.includes(term) || needle.includes(doc.name.toLowerCase()));
      if (titleHasTerm) score *= 1.6;

      const start = Math.max(0, firstIndex - SNIPPET_RADIUS);
      const end = Math.min(doc.text.length, firstIndex + SNIPPET_RADIUS + SNIPPET_RADIUS);
      const snippet = (start > 0 ? "…" : "") + doc.text.slice(start, end).replace(/\s+/g, " ").trim() + (end < doc.text.length ? "…" : "");

      rows.push({ doc, score, terms: worn, snippet });
    }

    rows.sort((a, b) => b.score - a.score);
    const hits: KnowledgeHit[] = rows.slice(0, limit).map((row) => ({
      path: row.doc.path,
      name: row.doc.name,
      score: Math.round(row.score * 100) / 100,
      terms: row.terms,
      snippet: row.snippet,
      size: row.doc.text.length,
    }));

    return { hits, indexed: { files: index.documents.length, bytes: index.bytes, builtAt: index.builtAt } };
  })();
}

/** Plain-text mirror of the top hits for feeding to the chat model / skills. */
export async function searchKnowledgeForChat(query: string, limit = 5): Promise<string> {
  const { hits, indexed } = await searchKnowledge(query, limit);
  if (hits.length === 0) return `No indexed documents mention "${query}". (Knowledge base: ${indexed.files} files.)`;
  const lines = hits.map(
    (hit, index) => `${index + 1}. ${hit.name} — score ${hit.score}\n   …${hit.snippet}…`
  );
  return `KNOWLEDGE RESULTS (${indexed.files} files indexed):\n${lines.join("\n")}`;
}