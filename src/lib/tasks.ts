import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Task } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");

const PRIORITIES: Task["priority"][] = ["low", "medium", "high", "urgent"];
const STATUSES: Task["status"][] = ["todo", "in_progress", "completed", "cancelled"];

export type TaskPatch = Partial<Pick<Task, "title" | "dueTime" | "priority" | "status">>;

interface StoredTask {
  id: string;
  title: string;
  dueTime?: string;
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
    dueTime: entry.dueTime,
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
  dueTime?: string;
  priority?: string;
}): Promise<Task> {
  const title = input.title.trim();
  const priority = PRIORITIES.includes(input.priority as Task["priority"])
    ? (input.priority as Task["priority"])
    : "medium";
  const dueTime = input.dueTime?.trim() || undefined;

  const list = await queueWrite((tasks) => {
    tasks.push({
      id: randomUUID(),
      title,
      dueTime,
      priority,
      status: "todo",
      createdAt: new Date().toISOString(),
    });
    return tasks;
  });

  return toStored(list[list.length - 1]);
}

export async function updateTask(id: string, patch: TaskPatch): Promise<Task | null> {
  const list = await queueWrite((tasks) => {
    const entry = tasks.find((task) => task.id === id);
    if (!entry) return tasks;

    if (typeof patch.title === "string") entry.title = patch.title.trim();
    if (typeof patch.dueTime === "string") entry.dueTime = patch.dueTime.trim() || undefined;
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