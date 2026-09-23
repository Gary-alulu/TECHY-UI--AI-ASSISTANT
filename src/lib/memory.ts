import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const MEMORY_FILE = path.join(DATA_DIR, "memory.json");

export type MemoryFactKind = "fact" | "preference";

export interface MemoryFact {
  id: string;
  content: string;
  kind: MemoryFactKind;
  source: string;
  createdAt: string;
}

export interface MemoryStore {
  facts: MemoryFact[];
  preferences: Record<string, string>;
}

const MAX_FACTS = 50;
const MAX_PREFERENCES = 30;

function emptyStore(): MemoryStore {
  return { facts: [], preferences: {} };
}

async function readStore(): Promise<MemoryStore> {
  try {
    const raw = await fs.readFile(MEMORY_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return emptyStore();
    return {
      facts: Array.isArray(parsed.facts) ? parsed.facts : [],
      preferences: typeof parsed.preferences === "object" && parsed.preferences !== null ? parsed.preferences : {},
    };
  } catch {
    return emptyStore();
  }
}

let writeQueue: Promise<unknown> = Promise.resolve();

function queueWrite(updater: (store: MemoryStore) => MemoryStore): Promise<MemoryStore> {
  const run = writeQueue.then(async () => {
    const next = updater(await readStore());
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(MEMORY_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
  writeQueue = run.catch(() => {});
  return run;
}

export async function getMemory(): Promise<MemoryStore> {
  return readStore();
}

export async function addFact(input: { content: string; kind?: MemoryFactKind; source?: string }): Promise<{ fact: MemoryFact | null; store: MemoryStore }> {
  const content = input.content.trim().slice(0, 400);
  if (!content) return { fact: null, store: await readStore() };
  const kind: MemoryFactKind = input.kind === "preference" ? "preference" : "fact";
  const source = input.source?.trim().slice(0, 80) || "user";

  let fact: MemoryFact | null = null;
  const store = await queueWrite((current) => {
    // De-duplicate near-identical statements (case-insensitive).
    const exists = current.facts.some((entry) => entry.content.toLowerCase() === content.toLowerCase());
    if (exists) return current;
    fact = { id: randomUUID(), content, kind, source, createdAt: new Date().toISOString() };
    current.facts.push(fact);
    current.facts = current.facts.slice(-MAX_FACTS);
    return current;
  });
  return { fact, store };
}

export async function removeFact(id: string): Promise<boolean> {
  let removed = false;
  await queueWrite((current) => {
    const filtered = current.facts.filter((entry) => entry.id !== id);
    removed = filtered.length !== current.facts.length;
    current.facts = filtered;
    return current;
  });
  return removed;
}

export async function clearFacts(): Promise<void> {
  await queueWrite((current) => {
    current.facts = [];
    return current;
  });
}

export async function setPreference(key: string, value: string): Promise<{ ok: boolean; store: MemoryStore }> {
  const cleanKey = key.trim().slice(0, 60);
  const cleanValue = value.trim().slice(0, 200);
  if (!cleanKey || !cleanValue) return { ok: false, store: await readStore() };
  const store = await queueWrite((current) => {
    current.preferences[cleanKey] = cleanValue;
    // Stable ordering, newest at the end; cap by dropping oldest keys.
    const keys = Object.keys(current.preferences);
    if (keys.length > MAX_PREFERENCES) {
      const drop = keys.slice(0, keys.length - MAX_PREFERENCES);
      for (const dropped of drop) delete current.preferences[dropped];
    }
    return current;
  });
  return { ok: true, store };
}

export async function removePreference(key: string): Promise<boolean> {
  let removed = false;
  await queueWrite((current) => {
    if (key in current.preferences) {
      delete current.preferences[key];
      removed = true;
    }
    return current;
  });
  return removed;
}

export async function clearMemory(): Promise<void> {
  await queueWrite((current) => {
    current.facts = [];
    return current;
  });
}

/** A compact summary of everything memory knows, for stuffing into a prompt. */
export async function memoryContext(limit = 15): Promise<string> {
  const store = await readStore();
  const lines: string[] = [];
  const preferences = Object.entries(store.preferences)
    .map(([key, value]) => `- Preference: ${key} = ${value}`)
    .sort();
  for (const preference of preferences) lines.push(preference);
  for (const fact of store.facts.slice(-limit)) {
    lines.push(`- ${fact.content}`);
  }
  if (lines.length === 0) return "";
  return `\n\n[Remembered about the user:\n${lines.join("\n")}\n]`;
}