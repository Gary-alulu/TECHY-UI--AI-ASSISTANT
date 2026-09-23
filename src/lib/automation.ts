import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Automation, AutomationAction, AutomationRun, AutomationTrigger } from "@/types";
import { extractText } from "@/lib/system/documents";
import { addNotification } from "@/lib/notifications";
import { addTask } from "@/lib/tasks";
import { buildBriefing } from "@/lib/briefing";
import { WORKSPACE_ROOT } from "@/lib/system/files";

export type { AutomationTrigger, AutomationAction };

const DATA_DIR = path.join(process.cwd(), "data");
const AUTOMATIONS_FILE = path.join(DATA_DIR, "automations.json");
const WATCH_DIR = path.join(DATA_DIR, "watch");
const SUMMARIES_DIR = path.join(DATA_DIR, "summaries");
const PROCESSED_DIR = path.join(DATA_DIR, "processed");

let writeQueue: Promise<unknown> = Promise.resolve();

interface StoredAutomation {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  state?: { seen: string[]; lastScheduleFire?: string };
  lastRunAt?: string;
  lastStatus?: AutomationRun["status"];
  createdAt: string;
  runs: Array<{
    id: string;
    startedAt: string;
    finishedAt?: string;
    status: AutomationRun["status"];
    summary: string;
    actions: AutomationRun["actions"];
  }>;
}

function toStored(entry: StoredAutomation, runs: StoredAutomation["runs"] = entry.runs): Automation {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    enabled: entry.enabled,
    trigger: entry.trigger,
    actions: entry.actions,
    state: entry.state,
    lastRunAt: entry.lastRunAt ? new Date(entry.lastRunAt) : undefined,
    lastStatus: entry.lastStatus,
    createdAt: new Date(entry.createdAt),
    runs: runs.map((run) => ({
      id: run.id,
      startedAt: new Date(run.startedAt),
      finishedAt: run.finishedAt ? new Date(run.finishedAt) : undefined,
      status: run.status,
      summary: run.summary,
      actions: run.actions,
    })),
  };
}

async function readStore(): Promise<StoredAutomation[]> {
  try {
    const raw = await fs.readFile(AUTOMATIONS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function queueWrite(updater: (store: StoredAutomation[]) => StoredAutomation[]): Promise<StoredAutomation[]> {
  const run = writeQueue.then(async () => {
    const next = updater(await readStore());
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(AUTOMATIONS_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
  writeQueue = run.catch(() => {});
  return run;
}

export async function getAutomations(): Promise<Automation[]> {
  return (await readStore()).map((entry) => toStored(entry));
}

export async function getAutomation(id: string): Promise<Automation | null> {
  const list = await readStore();
  const found = list.find((entry) => entry.id === id);
  return found ? toStored(found) : null;
}

export async function createAutomation(input: {
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  enabled?: boolean;
}): Promise<Automation> {
  const name = input.name.trim();
  if (!name) throw new Error("Workflow name is required");
  const actions = input.actions.length > 0 ? input.actions : [{ name: "notify" as const }];
  const list = await queueWrite((store) => {
    store.push({
      id: randomUUID(),
      name,
      description: input.description?.trim() || undefined,
      enabled: input.enabled ?? true,
      trigger: input.trigger,
      actions,
      createdAt: new Date().toISOString(),
      runs: [],
    });
    return store;
  });
  return toStored(list[list.length - 1]);
}

export async function updateAutomation(id: string, patch: Partial<Pick<Automation, "name" | "description" | "enabled" | "trigger" | "actions">>): Promise<Automation | null> {
  const list = await queueWrite((store) => {
    const entry = store.find((automation) => automation.id === id);
    if (!entry) return store;
    if (typeof patch.name === "string") entry.name = patch.name.trim();
    if (typeof patch.description === "string") entry.description = patch.description.trim() || undefined;
    if (typeof patch.enabled === "boolean") entry.enabled = patch.enabled;
    if (patch.trigger) entry.trigger = patch.trigger;
    if (patch.actions) entry.actions = patch.actions;
    return store;
  });
  const updated = list.find((automation) => automation.id === id);
  return updated ? toStored(updated) : null;
}

export async function deleteAutomation(id: string): Promise<boolean> {
  let existed = false;
  await queueWrite((store) => {
    const filtered = store.filter((automation) => automation.id !== id);
    existed = store.length !== filtered.length;
    return filtered;
  });
  return existed;
}

/** Converts a simple glob like `*.pdf` into a RegExp. */
function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

async function listFilesIn(folder: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(folder, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && !entry.isSymbolicLink())
      .map((entry) => path.join(folder, entry.name));
  } catch {
    return [];
  }
}

/** Keeps every automation-understood path inside the workspace, creating dirs as needed. */
function workspaceDir(relative: string): string {
  const target = path.resolve(WORKSPACE_ROOT, relative.startsWith("data") ? relative : path.join("data", relative));
  if (!target.startsWith(WORKSPACE_ROOT)) throw new Error("Target must stay inside the workspace");
  return target;
}

/** Extractive offline summarizer: top sentences by word-frequency scoring. */
export function summarizeText(text: string, maxSentences = 4): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 24 && sentence.length <= 600)
    .slice(0, 80);
  if (sentences.length === 0) return clean.slice(0, 400);

  const words = clean.toLowerCase().split(/[^\p{L}\p{N}']+/u);
  const frequency = new Map<string, number>();
  for (const word of words) {
    if (word.length < 3) continue;
    frequency.set(word, (frequency.get(word) ?? 0) + 1);
  }

  const ranked = sentences
    .map((sentence, index) => {
      const score = sentence
        .toLowerCase()
        .split(/[^\p{L}\p{N}']+/u)
        .filter((word) => word.length >= 3)
        .reduce((total, word) => total + (frequency.get(word) ?? 0), 0);
      return { sentence, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, maxSentences)
    .sort((a, b) => a.index - b.index);

  let result = ranked.map((entry) => entry.sentence).join(" ");
  if (result.length < clean.length * 0.4 && ranked.length > 0) {
    result = ranked.map((entry) => entry.sentence).join(" ");
  }
  return result || clean.slice(0, 400);
}

interface RunContext {
  files: string[];
  text: string;
  summary: string;
  summaryPath?: string;
  renamedPath?: string;
  movedPath?: string;
}

async function runAction(action: AutomationAction, context: RunContext): Promise<{ status: "completed" | "failed"; detail: string }> {
  const params = action.params ?? {};
  try {
    switch (action.name) {
      case "read_text": {
        const target = context.files[0] ?? params.file;
        if (!target || !path.isAbsolute(target)) throw new Error("No file to read");
        const { text, note } = await extractText(target);
        if (!text && note) throw new Error(note);
        context.text = text.slice(0, 100_000);
        return { status: "completed", detail: `Read ${path.basename(target)} (${context.text.length} chars)` };
      }
      case "summarize": {
        context.summary = summarizeText(context.text, 4);
        await fs.mkdir(SUMMARIES_DIR, { recursive: true });
        const source = context.files[0];
        const base = source ? path.basename(source).replace(/\.[^.]+$/, "") : "briefing";
        context.summaryPath = path.join(SUMMARIES_DIR, `${base}.summary.txt`);
        await fs.writeFile(context.summaryPath, context.summary || "No text to summarize.", "utf8");
        return { status: "completed", detail: `Summarized to ${context.summaryPath}` };
      }
      case "rename": {
        const target = context.files[0];
        if (!target) throw new Error("No file to rename");
        const dir = path.dirname(target);
        const ext = path.extname(target);
        const name = path.basename(target, ext);
        const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const rendered = (params.pattern ?? "{name}-{date}{ext}")
          .replace("{name}", name)
          .replace("{date}", stamp)
          .replace("{ext}", ext);
        const safe = path.basename(rendered);
        context.renamedPath = path.join(dir, safe);
        await fs.rename(target, context.renamedPath);
        return { status: "completed", detail: `Renamed to ${safe}` };
      }
      case "move": {
        const source = context.renamedPath ?? context.files[0];
        if (!source) throw new Error("No file to move");
        const targetDir = workspaceDir(params.target ?? "processed");
        await fs.mkdir(targetDir, { recursive: true });
        context.movedPath = path.join(targetDir, path.basename(source));
        await fs.rename(source, context.movedPath);
        context.files = [context.movedPath];
        return { status: "completed", detail: `Moved to ${context.movedPath}` };
      }
      case "create_task": {
        const title = params.title ?? (context.files[0] ? `Process ${path.basename(context.files[0])}` : "Automation task");
        await addTask({ title });
        return { status: "completed", detail: `Task created: ${title}` };
      }
      case "briefing": {
        const briefing = await buildBriefing();
        const lines = brieingLines(briefing);
        await addNotification({ kind: "briefing", title: briefing.greeting, body: lines.join("\n"), source: "automation" });
        return { status: "completed", detail: `Briefing posted (${lines.length} lines)` };
      }
      case "notify": {
        const summary = context.summary || context.text.slice(0, 240);
        const title = params.title ?? (context.files[0] ? `Processed ${path.basename(context.files[0])}` : "Automation complete");
        await addNotification({
          kind: "automation",
          title,
          body: summary || "Workflow finished.",
          source: "automation",
        });
        return { status: "completed", detail: `Notified: ${title}` };
      }
      default: {
        const exhaustive: never = action.name;
        throw new Error(`Unknown action: ${String(exhaustive)}`);
      }
    }
  } catch (error) {
    return { status: "failed", detail: error instanceof Error ? error.message : "Action failed" };
  }
}

function brieingLines(briefing: Awaited<ReturnType<typeof buildBriefing>>): string[] {
  const lines: string[] = [];
  const { sections } = briefing;
  if (sections.meetings.count > 0) lines.push(`📅 ${sections.meetings.count} meeting(s)`);
  if (sections.tasks.count > 0) lines.push(`✅ ${sections.tasks.count} task(s)`);
  lines.push(`🖥 CPU ${sections.system.cpu}% · RAM ${sections.system.ram}%`);
  for (const recommendation of sections.recommendations) lines.push(`💡 ${recommendation.text}`);
  return lines;
}

async function pushRun(id: string, run: AutomationRun): Promise<void> {
  await queueWrite((store) => {
    const entry = store.find((automation) => automation.id === id);
    if (!entry) return store;
    entry.lastRunAt = run.startedAt.toISOString();
    entry.lastStatus = run.status;
    entry.runs.unshift({
      id: run.id,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString(),
      status: run.status,
      summary: run.summary,
      actions: run.actions,
    });
    entry.runs = entry.runs.slice(0, 20);
    return store;
  });
}

async function saveState(id: string, state: NonNullable<Automation["state"]>): Promise<void> {
  await queueWrite((store) => {
    const entry = store.find((automation) => automation.id === id);
    if (entry) entry.state = state;
    return store;
  });
}

/** Executes a workflow now. `files` lets callers (or triggers) scope the run to specific files. */
export async function runAutomation(id: string, files: string[] = []): Promise<AutomationRun> {
  const stored = (await readStore()).find((entry) => entry.id === id);
  if (!stored) throw new Error("Automation not found");
  const workflow = toStored(stored);

  const run: AutomationRun = {
    id: randomUUID(),
    startedAt: new Date(),
    status: "running",
    summary: "",
    actions: [],
  };

  await pushRun(id, { ...run, status: "running", actions: [] });

  const context: RunContext = { files, text: "", summary: "" };
  for (const action of workflow.actions) {
    const result = await runAction(action, context);
    run.actions.push({ name: action.name, status: result.status, detail: result.detail });
    if (result.status === "failed") {
      run.status = "failed";
      run.summary = `${workflow.name} failed at “${action.name}” — ${result.detail}`;
      run.finishedAt = new Date();
      await queueWrite((store) => {
        const entry = store.find((automation) => automation.id === id);
        if (entry) {
          entry.lastStatus = "failed";
          entry.lastRunAt = run.startedAt.toISOString();
          const storedRun = entry.runs.find((item) => item.id === run.id);
          if (storedRun) {
            storedRun.status = "failed";
            storedRun.summary = run.summary;
            storedRun.finishedAt = run.finishedAt!.toISOString();
            storedRun.actions = run.actions;
          }
        }
        return store;
      });
      try {
        const { logActivity } = await import("@/lib/activity");
        await logActivity({ actor: "automation", kind: "automation", action: `Workflow failed: ${workflow.name}`, detail: run.summary });
      } catch {
        // log best-effort
      }
      return run;
    }
  }

  run.status = "completed";
  run.summary = `${workflow.name} · ${run.actions.length} action(s)${context.files.length > 0 ? ` · ${context.files.map((file) => path.basename(file)).join(", ")}` : ""}`;
  run.finishedAt = new Date();
  await queueWrite((store) => {
    const entry = store.find((automation) => automation.id === id);
    if (entry) {
      entry.lastStatus = "completed";
      entry.lastRunAt = run.startedAt.toISOString();
      const storedRun = entry.runs.find((item) => item.id === run.id);
      if (storedRun) {
        storedRun.status = "completed";
        storedRun.summary = run.summary;
        storedRun.finishedAt = run.finishedAt!.toISOString();
        storedRun.actions = run.actions;
      }
    }
    return store;
  });
  try {
    const { logActivity } = await import("@/lib/activity");
    await logActivity({ actor: "automation", kind: "automation", action: `Workflow completed: ${workflow.name}`, detail: run.summary });
  } catch {
    // log best-effort
  }
  return run;
}

/**
 * Polls every enabled automation and fires those whose trigger conditions are met:
 *  - file watches fire when new matching files appear (baseline tracked in state.seen);
 *  - scheduled automations fire once per matching weekday + time window.
 */
export async function sweepAutomations(): Promise<{ fired: AutomationRun[] }> {
  const now = new Date();
  const store = await readStore();
  const fired: AutomationRun[] = [];

  for (const entry of store) {
    if (!entry.enabled) continue;
    const trigger = entry.trigger;

    if (trigger.type === "file_watch") {
      const folder = workspaceDir(trigger.folder || "watch");
      const matcher = globToRegExp(trigger.pattern || "*");
      const current = (await listFilesIn(folder)).filter((file) => matcher.test(path.basename(file)));
      const seen = new Set(entry.state?.seen ?? []);
      const fresh = current.filter((file) => !seen.has(file));
      if (fresh.length > 0) {
        await saveState(entry.id, { seen: current, lastScheduleFire: entry.state?.lastScheduleFire });
        fired.push(await runAutomation(entry.id, fresh));
        continue;
      }
      if (seen.size !== current.length) {
        await saveState(entry.id, { seen: current, lastScheduleFire: entry.state?.lastScheduleFire });
      }
      continue;
    }

    if (trigger.type === "schedule") {
      const dayMatches = trigger.dayOfWeek === now.getDay();
      const minute = now.getHours() * 60 + now.getMinutes();
      const windowStart = trigger.hour * 60 + trigger.minute;
      const todayKey = now.toISOString().slice(0, 10);
      if (dayMatches && Math.abs(minute - windowStart) <= 2 && entry.state?.lastScheduleFire !== todayKey) {
        await saveState(entry.id, { seen: entry.state?.seen ?? [], lastScheduleFire: todayKey });
        fired.push(await runAutomation(entry.id));
      }
    }
  }

  return { fired };
}

/** Ensures the watch/summaries/processed folders exist (used on requests). */
export async function ensureAutomationDirs(): Promise<void> {
  await Promise.all([
    fs.mkdir(WATCH_DIR, { recursive: true }),
    fs.mkdir(SUMMARIES_DIR, { recursive: true }),
    fs.mkdir(PROCESSED_DIR, { recursive: true }),
  ]);
}

export { WATCH_DIR, SUMMARIES_DIR, PROCESSED_DIR };