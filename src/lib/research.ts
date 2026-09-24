import dns from "node:dns/promises";
import { getSecurityPolicy } from "@/lib/security";
import type { SecurityPolicy } from "@/types";
import { probeInternet } from "@/lib/offline";
import { searchKnowledge, searchKnowledgeForChat } from "@/lib/knowledge";
import { askLocalModel } from "@/lib/ai/ollama";

const MAX_PAGE_BYTES = 1_500_000;
const MAX_PAGE_CHARS = 12_000;
const SEARCH_LIMIT = 6;
const FETCH_LIMIT = 4;
const FETCH_TIMEOUT_MS = 15_000;
const SEARCH_TIMEOUT_MS = 12_000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TECHY-Research/1.0 (local assistant)";

export interface ResearchSource {
  index: number;
  title: string;
  url: string;
  snippet: string;
  origin: "web" | "local";
}

export interface ResearchReport {
  question: string;
  mode: "web" | "local";
  generatedAt: string;
  internet: boolean;
  fallback?: "no-internet";
  summary: string;
  keyFindings: string[];
  contradictions: string[];
  sources: ResearchSource[];
  usedModel: boolean;
  markdown: string;
}

export type ResearchGate =
  | { allowed: true; mode: "web" | "local"; internet: boolean; network: string }
  | { allowed: false; reason: string; internet: boolean; network: string };

/** Decides whether web research may run, or whether we fall back to the local knowledge base. */
export async function researchGate(scope: "web" | "local"): Promise<ResearchGate> {
  const policy: SecurityPolicy = await getSecurityPolicy();
  const network = policy.network;
  if (scope === "local") return { allowed: true, mode: "local", internet: false, network };
  const internet = policy.localOnly ? false : await probeInternet();
  if (policy.localOnly) return { allowed: true, mode: "local", internet: false, network };
  if (!internet) return { allowed: true, mode: "local", internet: false, network };
  if (network === "restricted") {
    return {
      allowed: false,
      reason: "Network policy is restricted — web research stays off until you allow the Network category in Security.",
      internet,
      network,
    };
  }
  return { allowed: true, mode: "web", internet, network };
}

// ── HTML → text ────────────────────────────────────────

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "));
}

interface ExtractedPage {
  title: string;
  text: string;
  links: string[];
}

function htmlToText(html: string): ExtractedPage {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ");
  const title = stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(cleaned)?.[1] ?? "").trim();

  const links: string[] = [];
  const linkPattern = /<a\s[^>]*?href="([^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(cleaned)) !== null && links.length < 60) {
    const raw = decodeEntities(match[1]).trim();
    if (/^https?:\/\//i.test(raw)) links.push(raw);
  }

  const body = cleaned
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(body)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_PAGE_CHARS);

  return { title, text, links };
}

// ── SSRF-guarded fetch ────────────────────────────────

const PRIVATE_PATTERNS: Array<(ip: string) => boolean> = [
  (ip) => ip === "0.0.0.0" || ip === "::",
  (ip) => ip === "127.0.0.1" || ip.startsWith("127."),
  (ip) => ip === "::1",
  (ip) => ip.startsWith("10."),
  (ip) => ip.startsWith("192.168."),
  (ip) => ip.startsWith("169.254.") || ip === "fe80::1",
  (ip) => /^172\.(1[6-9]|2\d|3[01])\./.test(ip),
  (ip) => /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip),
  (ip) => ip.startsWith("fc") || ip.startsWith("fd"),
  (ip) => ip.startsWith("ff"),
];

async function safeFetch(url: string, timeoutMs: number): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Only http/https URLs are fetched");
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "[::1]") {
    throw new Error("Local hosts are not fetched");
  }
  const addresses = await dns.lookup(host, { all: true });
  if (addresses.length === 0) throw new Error("Host could not be resolved");
  for (const entry of addresses) {
    if (PRIVATE_PATTERNS.some((test) => test(entry.address))) throw new Error("Blocked private network address");
  }

  const response = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);

  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      chunks.push(value);
      if (total > MAX_PAGE_BYTES) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

// ── Web search (DuckDuckGo HTML, no key) ───────────────

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

function unwrapDdgUrl(href: string): string {
  const absolute = /^https?:\/\//i.test(href) ? href : `https:${href}`;
  try {
    const parsed = new URL(absolute);
    const target = parsed.searchParams.get("uddg");
    if (target) return target;
    if (parsed.hostname.endsWith("duckduckgo.com")) return absolute;
    return absolute;
  } catch {
    return href;
  }
}

export async function searchWeb(query: string, limit = SEARCH_LIMIT): Promise<SearchHit[]> {
  const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await safeFetch(endpoint, SEARCH_TIMEOUT_MS);

  const anchors: Array<{ url: string; title: string }> = [];
  const anchorPattern = /<a\s+([^>]*class="result__a"[^>]*)>([\s\S]*?)<\/a>/g;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html)) !== null && anchors.length < limit * 2) {
    const href = /href="([^"]+)"/.exec(match[1])?.[1];
    if (!href) continue;
    const title = stripTags(match[2]).trim();
    if (title) anchors.push({ url: unwrapDdgUrl(href), title });
  }

  const snippets: string[] = [];
  const snippetPattern = /<(?:a|span)\s+[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|span)>/g;
  while ((match = snippetPattern.exec(html)) !== null && snippets.length < anchors.length) {
    snippets.push(stripTags(match[1]).trim());
  }

  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  for (let i = 0; i < anchors.length && hits.length < limit; i += 1) {
    const anchor = anchors[i];
    let host = "";
    try {
      host = new URL(anchor.url).hostname;
    } catch {
      continue;
    }
    if (!/^https?:\/\//i.test(anchor.url)) continue;
    if (seen.has(host + anchor.title.slice(0, 24))) continue;
    seen.add(host + anchor.title.slice(0, 24));
    hits.push({ title: anchor.title, url: anchor.url, snippet: snippets[i] ?? "" });
  }
  if (hits.length === 0) throw new Error("Search returned no usable results");
  return hits;
}

// ── Analysis helpers ──────────────────────────────────

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 40 && sentence.length <= 340);
}

function tokenizeWords(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

const STOP_WORDS = new Set([
  "the", "and", "for", "you", "your", "that", "with", "this", "from", "are", "was", "were", "have", "has",
  "will", "can", "may", "not", "but", "its", "it's", "about", "which", "when", "what", "how", "why", "who",
  "into", "than", "then", "them", "they", "their", "there", "here", "been", "being", "would", "could", "should",
  "such", "each", "other", "more", "most", "some", "any", "all", "one", "two", "also", "via", "per", "out",
]);

function questionTerms(question: string): string[] {
  return tokenizeWords(question).filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function scoreSentence(sentence: string, questionTermsList: string[], position: number): number {
  const words = tokenizeWords(sentence);
  const unique = new Set(words);
  let score = 0;
  for (const term of questionTermsList) {
    if (unique.has(term)) score += 3;
    else if (words.some((word) => word.startsWith(term.slice(0, 5)) && term.length > 4)) score += 1.5;
  }
  if (position < 3) score += 2;
  else if (position < 8) score += 1;
  if (/\d/.test(sentence)) score += 0.5;
  return score;
}

function nearDuplicate(a: string, b: string): boolean {
  const setA = new Set(tokenizeWords(a).filter((word) => !STOP_WORDS.has(word)));
  const setB = new Set(tokenizeWords(b).filter((word) => !STOP_WORDS.has(word)));
  if (setA.size === 0 || setB.size === 0) return false;
  let shared = 0;
  for (const word of setA) if (setB.has(word)) shared += 1;
  return shared / Math.min(setA.size, setB.size) > 0.72;
}

function pickFindings(corpus: Array<{ text: string; label: string }>, question: string, max = 6): string[] {
  const terms = questionTerms(question);
  const candidates: Array<{ sentence: string; label: string; score: number }> = [];
  for (const entry of corpus) {
    sentences(entry.text).forEach((sentence, position) => {
      const score = scoreSentence(sentence, terms, position);
      if (score > 0) candidates.push({ sentence, label: entry.label, score });
    });
  }
  candidates.sort((a, b) => b.score - a.score);

  const picked: string[] = [];
  for (const candidate of candidates) {
    if (picked.length >= max) break;
    if (picked.some((existing) => nearDuplicate(existing, candidate.sentence))) continue;
    picked.push(candidate.sentence);
  }
  return picked;
}

/** Lightweight heuristic: sentences that start alike but diverge are flagged as conflicting accounts. */
function detectContradictions(corpus: Array<{ text: string; label: string }>): string[] {
  const flagged: string[] = [];
  const signatures = new Map<string, string>();
  for (const entry of corpus) {
    for (const sentence of sentences(entry.text).slice(0, 14)) {
      const words = tokenizeWords(sentence).filter((word) => !STOP_WORDS.has(word));
      if (words.length < 6) continue;
      const key = words.slice(0, 6).join(" ");
      const existing = signatures.get(key);
      if (existing && !nearDuplicate(existing, sentence)) {
        flagged.push(sentence);
        if (flagged.length >= 3) return flagged;
      } else if (!existing) {
        signatures.set(key, sentence);
      }
    }
  }
  return flagged;
}

function trimSummary(text: string, max = 2000): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(".") + 1)}…`;
}

export function renderResearchMarkdown(report: ResearchReport): string {
  const lines: string[] = [
    `# Research Report: ${report.question}`,
    "",
    `_Mode: ${report.mode === "web" ? `web (${report.sources.length} sources)` : "local knowledge base"} · generated ${report.generatedAt}${report.usedModel ? " · local model" : ""}_`,
    "",
    "## Summary",
    "",
    report.summary,
    "",
    "## Key findings",
    "",
    ...report.keyFindings.map((finding, index) => `${index + 1}. ${finding}`),
    "",
    "## Contradictions",
    "",
    report.contradictions.length > 0 ? report.contradictions.map((item) => `- ${item}`).join("\n") : "_No conflicting claims detected._",
    "",
    "## Sources",
    "",
    ...report.sources.map((source) => `- [${source.index}] ${source.title} — ${source.origin === "web" ? source.url : source.url}`),
    "",
    `— Generated by TECHY (local-first). Internet: ${report.internet ? "yes" : "no"}.`,
  ];
  return lines.join("\n");
}

// ── Main entry ────────────────────────────────────────

export async function conductResearch(
  question: string,
  mode: "web" | "local",
  options: { internet: boolean; fallback?: "no-internet" } = { internet: false }
): Promise<ResearchReport> {
  const base = {
    question,
    generatedAt: new Date().toISOString(),
    internet: options.internet,
    fallback: options.fallback,
    contradictions: [] as string[],
  };

  if (mode === "local") {
    const { hits } = await searchKnowledge(question, 6);
    const context = hits.length > 0 ? await searchKnowledgeForChat(question, 5) : "";
    const corpus = hits.map((hit) => ({ text: `${hit.name}. ${hit.snippet}`, label: hit.path }));
    const summary = hits.length > 0
      ? trimSummary(context, 2000)
      : `Nothing in the local knowledge base matches "${question}" yet. Add documents under the workspace, or switch to web research when online.`;
    const report: ResearchReport = {
      ...base,
      mode: "local",
      summary,
      keyFindings: pickFindings(corpus, question, 5),
      contradictions: detectContradictions(corpus),
      sources: hits.map((hit, index) => ({
        index: index + 1,
        title: hit.name,
        url: hit.path,
        snippet: hit.snippet,
        origin: "local" as const,
      })),
      usedModel: false,
      markdown: "",
    };
    report.markdown = renderResearchMarkdown(report);
    return report;
  }

  const hits = await searchWeb(question, SEARCH_LIMIT);
  const fetched: Array<{ url: string; title: string; snippet: string; text: string }> = [];
  for (const hit of hits.slice(0, FETCH_LIMIT)) {
    try {
      const html = await safeFetch(hit.url, FETCH_TIMEOUT_MS);
      const page = htmlToText(html);
      fetched.push({ url: hit.url, title: page.title || hit.title, snippet: hit.snippet, text: `${hit.snippet}\n${page.text}` });
    } catch {
      fetched.push({ url: hit.url, title: hit.title, snippet: hit.snippet, text: hit.snippet });
    }
  }

  const corpus = fetched.map((page) => ({ text: page.text, label: page.title }));
  const findings = pickFindings(corpus, question, 6);
  const contradictions = detectContradictions(corpus);
  const deterministicSummary = trimSummary(findings.slice(0, 3).join(" "), 2000);

  let summary = deterministicSummary;
  let usedModel = false;
  const modelAnswer = await askLocalModel(
    [
      {
        role: "user",
        content:
          `Question: ${question}\n\n` +
          fetched.map((page, index) => `[${index + 1}] ${page.title} (${page.url})\n${page.snippet || page.text.slice(0, 600)}`).join("\n\n") +
          `\n\nWrite a tight 2-3 paragraph answer using only these sources. Cite sources inline as [1], [2].`,
      },
      { role: "system", content: "You are TECHY in Research Mode. Cite only sources provided. If sources are thin, say so plainly." }
    ],
    { timeoutMs: 90_000 }
  );
  if (modelAnswer) {
    summary = trimSummary(modelAnswer, 3000);
    usedModel = true;
  }

  const report: ResearchReport = {
    ...base,
    mode: "web",
    summary,
    keyFindings: findings,
    contradictions,
    sources: fetched.map((page, index) => ({
      index: index + 1,
      title: page.title,
      url: page.url,
      snippet: (page.snippet || page.text.slice(0, 240)).slice(0, 400),
      origin: "web" as const,
    })),
    usedModel,
    markdown: "",
  };
  report.markdown = renderResearchMarkdown(report);
  return report;
}
