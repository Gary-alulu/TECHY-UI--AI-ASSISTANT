import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AudioTranscriptEntry } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const AUDIO_FILE = path.join(DATA_DIR, "audio-transcripts.json");

const MAX_ENTRIES = 40;

async function readStore(): Promise<AudioTranscriptEntry[]> {
  try {
    const raw = await fs.readFile(AUDIO_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let writeQueue: Promise<unknown> = Promise.resolve();

function queueWrite(updater: (store: AudioTranscriptEntry[]) => AudioTranscriptEntry[]): Promise<AudioTranscriptEntry[]> {
  const run = writeQueue.then(async () => {
    const next = updater(await readStore());
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(AUDIO_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
  writeQueue = run.catch(() => {});
  return run;
}

// ── Deterministic offline audio intelligence ───────────

const SPEAKER_LABEL = /^\s*(speaker\s*[0-9]|person\s*[0-9]|interviewer|interviewee|host|guest|caller|\d{1,2}\s*:|\w+\s*:)\s*/i;

interface SpeakerBlock {
  speaker: string;
  text: string;
}

/** Groups a transcript into speaker segments using inline labels or paragraph breaks. */
export function splitSpeakers(transcript: string): { blocks: SpeakerBlock[]; speakerCount: number } {
  const lines = transcript.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const blocks: SpeakerBlock[] = [];
  let current: SpeakerBlock | null = null;

  for (const line of lines) {
    const labelMatch = line.match(SPEAKER_LABEL);
    const speaker = labelMatch ? labelMatch[1].replace(/:$/, "").trim().toLowerCase() : null;
    if (speaker && current && current.speaker === speaker) {
      current.text += ` ${line.slice(labelMatch![0].length)}`;
      continue;
    }
    if (speaker) {
      current = { speaker: speaker[0].toUpperCase() + speaker.slice(1), text: line.slice(labelMatch![0].length) };
      blocks.push(current);
    } else if (current) {
      current.text += ` ${line}`;
    } else {
      current = { speaker: "Speaker 1", text: line };
      blocks.push(current);
    }
  }

  const speakerCount = new Set(blocks.map((block) => block.speaker)).size;
  return { blocks, speakerCount };
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 8);
}

function scoreSentence(clean: string, transcript: string): number {
  let score = 0;
  const frequency = transcript.split(" ").length;
  score += Math.min(clean.split(" ").length / Math.max(frequency / 30, 1), 3);
  if (/(decide|decision|agreed|approved|launch|release|final|deadline|budget|confirmed|next step)/i.test(clean)) score += 2;
  if (/(maybe|perhaps|not sure|think)/i.test(clean)) score -= 1;
  return score;
}

/** Extractive, offline summary choosing the highest-scoring sentences in order. */
export function summarizeTranscript(transcript: string, maximum = 4): string {
  const sentencesList = sentences(transcript);
  if (sentencesList.length === 0) return "No meaningful content was captured for a summary.";
  const ranked = sentencesList
    .map((text, index) => ({ text, index, score: scoreSentence(text, transcript) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maximum)
    .sort((a, b) => a.index - b.index);
  return ranked.map(({ text }) => text).join(" ");
}

/** Extracts action-item style sentences: imperatives and follow-through phrases. */
export function extractActionItems(transcript: string): string[] {
  const items: string[] = [];
  const sentencesList = sentences(transcript);
  for (const text of sentencesList) {
    const clean = text.trim();
    if (!/(^|,|\s)(send|update|schedule|prepare|create|write|share|email|call|follow up|follow-up|set up|book|review|confirm|design|build|fix|ask|deliver|finish|research|check)\b/i.test(clean)) continue;
    const normalized = clean.replace(/(^|[,;\s-]+)(next step[:\s-]+|action item[:\s-]+|to-do[:\s-]+|todo[:\s-]+)/i, "$1");
    items.push(normalized.length > 200 ? `${normalized.slice(0, 200)}…` : normalized);
    if (items.length >= 12) break;
  }
  return Array.from(new Set(items));
}

export interface AudioIntelligenceResult {
  transcript: string;
  speakerCount: number;
  blocks: Array<{ speaker: string; text: string }>;
  summary: string;
  actionItems: string[];
  saved: boolean;
}

export async function processTranscript(name: string, source: string, transcript: string): Promise<AudioIntelligenceResult> {
  const cleanTranscript = transcript.trim();
  const { blocks, speakerCount } = splitSpeakers(cleanTranscript);
  const summary = summarizeTranscript(cleanTranscript);
  const actionItems = extractActionItems(cleanTranscript);

  const entry: AudioTranscriptEntry = {
    id: randomUUID(),
    name,
    source,
    transcript: cleanTranscript,
    speakers: speakerCount,
    summary,
    actionItems,
    processedAt: new Date().toISOString(),
  };

  await queueWrite((store) => [entry, ...store].slice(0, MAX_ENTRIES));

  return {
    transcript: cleanTranscript,
    speakerCount,
    blocks,
    summary,
    actionItems,
    saved: true,
  };
}

export async function getAudioTranscripts(): Promise<AudioTranscriptEntry[]> {
  return readStore();
}

export async function deleteAudioTranscript(id: string): Promise<boolean> {
  let existed = false;
  await queueWrite((store) => {
    const filtered = store.filter((entry) => entry.id !== id);
    existed = store.length !== filtered.length;
    return filtered;
  });
  return existed;
}

export function mediaExtensions(): string[] {
  return [".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".opus", ".aiff", ".mp4", ".mkv", ".mov", ".webm", ".wma"];
}

export async function safeMediaFile(target: string): Promise<{ path: string; error?: string }> {
  const absolute = path.isAbsolute(target) ? target : path.join(process.cwd(), target);
  const name = path.basename(absolute);
  if (!mediaExtensions().some((extension) => name.toLowerCase().endsWith(extension))) {
    return { path: absolute, error: "Unsupported media file type" };
  }
  try {
    const stat = await fs.stat(absolute);
    if (!stat.isFile()) return { path: absolute, error: "Not a file" };
    if (stat.size > 500 * 1024 * 1024) return { path: absolute, error: "File too large" };
    return { path: absolute };
  } catch {
    return { path: absolute, error: "File not readable" };
  }
}