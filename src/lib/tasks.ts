import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Task, TaskRepeat } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");

const PRIORITIES: Task["priority"][] = ["low", "medium", "high", "urgent"];
const STATUSES: Task["status"][] = ["todo", "in_progress", "completed", "cancelled"];
const REPEATS: TaskRepeat[] = ["none", "daily", "weekly", "monthly"];

export type TaskPatch = Partial<
  Pick<Task, "title" | "description" | "dueTime" | "priority" | "status" | "tags" | "repeat">
> & { remindAt?: Date | string | null };

interface StoredTask {
  id: string;
  title: string;
  description?: string;
  dueTime?: string;
  remindAt?: string;
  repeat?: TaskRepeat;
  priority: Task["priority"];
  status: Task["status"];
  createdAt: string;
  completedAt?: string;
  tags?: string[];
}

function toDate(value: string): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function toStored(entry: StoredTask): Task {
  return {
    id: entry.id,
    title: entry.title,
    description: entry.description,
    dueTime: entry.dueTime,
    remindAt: entry.remindAt ? toDate(entry.remindAt) : undefined,
    repeat: entry.repeat ?? undefined,
    priority: entry.priority,
    status: entry.status,
    createdAt: toDate(entry.createdAt),
    completedAt: entry.completedAt ? toDate(entry.completedAt) : undefined,
    tags: entry.tags,
  };
}

async function readStore(): Promise<StoredTask[]> {
  try {
    const raw = await fs.readFile(TASKS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Serializes writes so concurrent requests cannot race a previous save. */
let writeQueue: Promise<unknown> = Promise.resolve();

function queueWrite(updater: (tasks: StoredTask[]) => StoredTask[]): Promise<StoredTask[]> {
  const run = writeQueue.then(async () => {
    const next = updater(await readStore());
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(TASKS_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
  writeQueue = run.catch(() => {});
  return run;
}

export async function getTasks(): Promise<Task[]> {
  return (await readStore()).map(toStored);
}

export async function addTask(input: {
  title: string;
  description?: string;
  dueTime?: string;
  remindAt?: Date | string | null;
  repeat?: TaskRepeat;
  priority?: string;
  tags?: string[];
}): Promise<Task> {
  const title = input.title.trim();
  const priority = PRIORITIES.includes(input.priority as Task["priority"])
    ? (input.priority as Task["priority"])
    : "medium";
  const dueTime = input.dueTime?.trim() || undefined;
  const description = input.description?.trim() || undefined;
  const remindAt = toIso(input.remindAt);
  const repeat = REPEATS.includes(input.repeat ?? "none") ? (input.repeat === "none" ? undefined : input.repeat) : undefined;
  const tags = sanitizeTags(input.tags);

  const list = await queueWrite((tasks) => {
    tasks.push({
      id: randomUUID(),
      title,
      description,
      dueTime,
      remindAt,
      repeat,
      priority,
      status: "todo",
      createdAt: new Date().toISOString(),
      tags,
    });
    return tasks;
  });

  return toStored(list[list.length - 1]);
}

function toIso(value?: Date | string | null): string | undefined {
  if (!value) return undefined;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function sanitizeTags(value?: string[]): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const tags = value
    .map((tag) => (typeof tag === "string" ? tag.trim().slice(0, 40) : ""))
    .filter(Boolean);
  return tags.length > 0 ? tags.slice(0, 10) : undefined;
}

export async function updateTask(id: string, patch: TaskPatch): Promise<Task | null> {
  const list = await queueWrite((tasks) => {
    const entry = tasks.find((task) => task.id === id);
    if (!entry) return tasks;

    if (typeof patch.title === "string") entry.title = patch.title.trim();
    if (typeof patch.description === "string") entry.description = patch.description.trim() || undefined;
    if (typeof patch.dueTime === "string") entry.dueTime = patch.dueTime.trim() || undefined;
    if (patch.remindAt !== undefined) entry.remindAt = toIso(patch.remindAt);
    if (patch.repeat !== undefined) entry.repeat = REPEATS.includes(patch.repeat) ? (patch.repeat === "none" ? undefined : patch.repeat) : undefined;
    if (patch.tags !== undefined) entry.tags = sanitizeTags(patch.tags);
    if (patch.priority && PRIORITIES.includes(patch.priority)) entry.priority = patch.priority;
    if (patch.status && STATUSES.includes(patch.status)) {
      entry.status = patch.status;
      entry.completedAt = patch.status === "completed" ? new Date().toISOString() : undefined;
    }
    return tasks;
  });

  const updated = list.find((task) => task.id === id);
  return updated ? toStored(updated) : null;
}

export async function deleteTask(id: string): Promise<boolean> {
  let existed = false;
  await queueWrite((tasks) => {
    const filtered = tasks.filter((task) => task.id !== id);
    existed = tasks.length !== filtered.length;
    return filtered;
  });
  return existed;
}