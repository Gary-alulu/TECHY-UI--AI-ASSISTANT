import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AppNotification, NotificationKind } from "@/types";
import { getTasks } from "@/lib/tasks";
import { getEvents } from "@/lib/calendar";
import { getStorageInfo } from "@/lib/system/hardware";

const DATA_DIR = path.join(process.cwd(), "data");
const NOTIFICATIONS_FILE = path.join(DATA_DIR, "notifications.json");
const LOG_FILE = path.join(DATA_DIR, "notification-log.json");

let writeQueue: Promise<unknown> = Promise.resolve();

interface StoredNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  source?: string;
  createdAt: string;
  read: boolean;
}

function toStored(entry: StoredNotification): AppNotification {
  return {
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    body: entry.body,
    source: entry.source,
    createdAt: new Date(entry.createdAt),
    read: entry.read,
  };
}

async function readStore(): Promise<StoredNotification[]> {
  try {
    const raw = await fs.readFile(NOTIFICATIONS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function queueWrite(updater: (store: StoredNotification[]) => StoredNotification[]): Promise<StoredNotification[]> {
  const run = writeQueue.then(async () => {
    const next = updater(await readStore());
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(NOTIFICATIONS_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
  writeQueue = run.catch(() => {});
  return run;
}

async function readLog(): Promise<string[]> {
  try {
    const raw = await fs.readFile(LOG_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLog(keys: string[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(LOG_FILE, JSON.stringify(keys, null, 2), "utf8");
}

/** Adds a notification. `dedupeKey` (if given) prevents the same event from re-notifying. */
export async function addNotification(input: {
  kind: NotificationKind;
  title: string;
  body?: string;
  source?: string;
  dedupeKey?: string;
}): Promise<AppNotification | null> {
  if (input.dedupeKey) {
    const log = await readLog();
    const dayKey = `${new Date().toISOString().slice(0, 10)}|${input.dedupeKey}`;
    if (log.includes(dayKey)) return null;
    log.push(dayKey);
    await writeLog(log);
  }
  const list = await queueWrite((store) => {
    store.push({
      id: randomUUID(),
      kind: input.kind,
      title: input.title,
      body: input.body,
      source: input.source,
      createdAt: new Date().toISOString(),
      read: false,
    });
    return store;
  });
  const last = list[list.length - 1];
  return last ? toStored(last) : null;
}

export async function getNotifications(options: { limit?: number; filters?: { read?: boolean } } = {}): Promise<{
  notifications: AppNotification[];
  unread: number;
}> {
  await emitSystemNotifications();
  const store = await readStore();
  const sorted = store.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const readFilter = options.filters?.read;
  const filtered = readFilter == null ? sorted : sorted.filter((n) => n.read === readFilter);
  const notifications = filtered.slice(0, options.limit ?? 50).map(toStored);
  const unread = sorted.filter((n) => !n.read).length;
  return { notifications, unread };
}

export async function markNotificationRead(id: string): Promise<void> {
  await queueWrite((store) => {
    const found = store.find((n) => n.id === id);
    if (found) found.read = true;
    return store;
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await queueWrite((store) => store.map((n) => ({ ...n, read: true })));
}

export async function clearNotifications(): Promise<void> {
  await queueWrite(() => []);
}

/**
 * Derives ambient notifications (overdue tasks, meetings firing in 30 minutes,
 * low storage) and emits them once, deduped per day per event.
 */
async function emitSystemNotifications(): Promise<void> {
  const now = new Date();

  const tasks = await getTasks();
  for (const task of tasks) {
    if ((task.status === "todo" || task.status === "in_progress") && task.remindAt && task.remindAt.getTime() <= now.getTime()) {
      await addNotification({
        kind: "task_overdue",
        title: "Task overdue",
        body: `“${task.title}” was due at ${task.remindAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}.`,
        source: "tasks",
        dedupeKey: `overdue:${task.id}:${task.remindAt.toISOString().slice(0, 10)}`,
      });
    }
  }

  const events = await getEvents({ from: now, to: new Date(now.getTime() + 90 * 60_000) });
  for (const event of events) {
    const minutes = Math.round((event.start.getTime() - now.getTime()) / 60_000);
    if (minutes >= 0 && minutes <= 30) {
      await addNotification({
        kind: "meeting",
        title: "Meeting in half an hour",
        body: `${event.title} starts ${formatMinutes(minutes)}${event.location ? ` in ${event.location}` : ""}.`,
        source: "calendar",
        dedupeKey: `meeting:${event.id}:${event.start.toISOString().slice(0, 13)}`,
      });
    }
  }

  try {
    const storage = await getStorageInfo();
    if (storage.percentage > 90) {
      await addNotification({
        kind: "storage",
        title: "Storage running low",
        body: `Only ${storage.totalGB > 0 ? Math.round(storage.totalGB * (1 - storage.percentage / 100)) : 0} GB free on disk (${Math.round(storage.percentage)}% used).`,
        source: "system",
        dedupeKey: "storage-low",
      });
    }
  } catch {
    // storage stats are overridable
  }
}

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `in ${hours}h${rest ? ` ${rest}m` : ""}`;
}