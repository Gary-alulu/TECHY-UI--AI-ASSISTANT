import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { CommandHistoryEntry, CommandTemplate } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const COMMANDS_FILE = path.join(DATA_DIR, "commands.json");

const MAX_HISTORY = 200;
const MAX_TEMPLATES = 40;

interface CommandStore {
  history: CommandHistoryEntry[];
  templates: CommandTemplate[];
}

function emptyStore(): CommandStore {
  return { history: [], templates: [] };
}

async function readStore(): Promise<CommandStore> {
  try {
    const raw = await fs.readFile(COMMANDS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      history: Array.isArray(parsed.history) ? parsed.history : [],
      templates: Array.isArray(parsed.templates) ? parsed.templates : [],
    };
  } catch {
    return emptyStore();
  }
}

let writeQueue: Promise<unknown> = Promise.resolve();

function queueWrite(updater: (store: CommandStore) => CommandStore): Promise<CommandStore> {
  const run = writeQueue.then(async () => {
    const next = updater(await readStore());
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(COMMANDS_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
  writeQueue = run.catch(() => {});
  return run;
}

export const DEFAULT_TEMPLATES: CommandTemplate[] = [
  { id: "tpl-organize", label: "Organize Downloads", text: "Organize my Downloads folder", category: "files" },
  { id: "tpl-checksystem", label: "Check system", text: "Give me a system status summary", category: "system" },
  { id: "tpl-openworkspace", label: "Open workspace", text: "Open my design workspace", category: "apps" },
  { id: "tpl-summarizeclipboard", label: "Summarize clipboard", text: "Summarize what is on my clipboard", category: "general" },
  { id: "tpl-recentfiles", label: "Find recent files", text: "Find recent files", category: "files" },
  { id: "tpl-focus", label: "Start focus mode", text: "Start focus mode", category: "productivity" },
  { id: "tpl-briefing", label: "Prepare daily briefing", text: "Prepare my daily briefing", category: "productivity" },
  { id: "tpl-analyzescreen", label: "Analyze screen", text: "Analyze my screen", category: "system" },
];

export async function getCommands(): Promise<CommandStore> {
  const store = await readStore();
  if (store.templates.length === 0) {
    // Seed the default quick-command set on first use.
    await queueWrite((current) => {
      if (current.templates.length === 0) current.templates = DEFAULT_TEMPLATES;
      return current;
    });
    return { history: store.history, templates: DEFAULT_TEMPLATES };
  }
  return store;
}

export async function addCommandHistory(text: string, source = "user"): Promise<CommandHistoryEntry | null> {
  const clean = text.trim().slice(0, 300);
  if (!clean) return null;

  // De-duplicate exact repeats at the head of the list.
  const store = await readStore();
  if (store.history[0]?.text === clean) return store.history[0];

  const entry: CommandHistoryEntry = { id: randomUUID(), text: clean, source, createdAt: new Date().toISOString() };
  await queueWrite((current) => {
    current.history.unshift(entry);
    current.history = current.history.slice(0, MAX_HISTORY);
    return current;
  });
  return entry;
}

export async function deleteCommandHistory(id: string): Promise<boolean> {
  let existed = false;
  await queueWrite((store) => {
    const filtered = store.history.filter((entry) => entry.id !== id);
    existed = store.history.length !== filtered.length;
    store.history = filtered;
    return store;
  });
  return existed;
}

export async function addTemplate(input: { text: string; label?: string; description?: string; category?: CommandTemplate["category"] }): Promise<CommandTemplate | null> {
  const text = input.text.trim().slice(0, 300);
  if (!text) return null;
  const template: CommandTemplate = {
    id: randomUUID(),
    text,
    label: (input.label ?? text).trim().slice(0, 60),
    description: input.description?.trim().slice(0, 160),
    category: input.category ?? "general",
  };
  await queueWrite((store) => {
    store.templates.push(template);
    store.templates = store.templates.slice(0, MAX_TEMPLATES);
    return store;
  });
  return template;
}

export async function deleteTemplate(id: string): Promise<boolean> {
  let existed = false;
  await queueWrite((store) => {
    const filtered = store.templates.filter((entry) => entry.id !== id);
    existed = store.templates.length !== filtered.length;
    store.templates = filtered;
    return store;
  });
  return existed;
}

export async function clearHistory(): Promise<void> {
  await queueWrite((store) => {
    store.history = [];
    return store;
  });
}
