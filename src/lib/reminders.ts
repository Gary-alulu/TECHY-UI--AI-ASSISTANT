import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Task } from "@/types";
import { getTasks, updateTask } from "@/lib/tasks";
import { advanceRepeat } from "@/lib/schedule";

const DATA_DIR = path.join(process.cwd(), "data");
const LOG_FILE = path.join(DATA_DIR, "reminder-log.json");

export interface ReminderLogEntry {
  id: string;
  taskId: string;
  title: string;
  scheduledFor: string;
  firedAt: string;
  dismissed: boolean;
}

export interface DueReminder {
  id: string;
  taskId: string;
  title: string;
  priority: Task["priority"];
  scheduledFor: string;
  firedAt: string;
  minutesAgo: number;
}

export interface UpcomingReminder {
  taskId: string;
  title: string;
  priority: Task["priority"];
  remindAt: string;
  repeat?: Task["repeat"];
  minutesUntil: number;
}

let writeQueue: Promise<unknown> = Promise.resolve();

async function readLog(): Promise<ReminderLogEntry[]> {
  try {
    const raw = await fs.readFile(LOG_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function queueWriteLog(updater: (log: ReminderLogEntry[]) => ReminderLogEntry[]): Promise<ReminderLogEntry[]> {
  const run = writeQueue.then(async () => {
    const next = updater(await readLog());
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(LOG_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
  writeQueue = run.catch(() => {});
  return run;
}

/**
 * Fires any scheduled reminders that are due and advances repeating ones.
 * Idempotent per (taskId + scheduledFor) so repeated polls never double-fire.
 */
export async function sweepDueReminders(): Promise<{ fired: number }> {
  const tasks = await getTasks();
  const now = new Date();

  const due = tasks.filter(
    (task) =>
      (task.status === "todo" || task.status === "in_progress") &&
      task.remindAt != null &&
      task.remindAt.getTime() <= now.getTime()
  );
  if (due.length === 0) return { fired: 0 };

  const log = await readLog();
  const firedKeys = new Set(log.map((entry) => `${entry.taskId}|${entry.scheduledFor}`));

  let fired = 0;
  await queueWriteLog((entries) => {
    for (const task of due) {
      const key = `${task.id}|${task.remindAt!.toISOString()}`;
      if (firedKeys.has(key)) continue;
      entries.push({
        id: randomUUID(),
        taskId: task.id,
        title: task.title,
        scheduledFor: task.remindAt!.toISOString(),
        firedAt: now.toISOString(),
        dismissed: false,
      });
      fired += 1;
    }
    return entries;
  });

  // Advance repeating tasks to their next occurrence.
  const repeating = due.filter((task) => task.repeat && task.repeat !== "none");
  for (const task of repeating) {
    await updateTask(task.id, { remindAt: advanceRepeat(task.remindAt!, task.repeat!, now) });
  }

  return { fired };
}

export async function getReminderSnapshot(): Promise<{ due: DueReminder[]; upcoming: UpcomingReminder[] }> {
  await sweepDueReminders();
  const [tasks, log] = await Promise.all([getTasks(), readLog()]);
  const now = new Date();

  const completedTaskIds = new Set(
    tasks.filter((task) => task.status === "completed" || task.status === "cancelled").map((task) => task.id)
  );

  const pendingLog = log
    .filter((entry) => !entry.dismissed && !completedTaskIds.has(entry.taskId))
    .sort((a, b) => b.firedAt.localeCompare(a.firedAt))
    .slice(0, 20);

  const taskById = new Map(tasks.map((task) => [task.id, task]));

  const due: DueReminder[] = pendingLog.map((entry) => {
    const task = taskById.get(entry.taskId);
    const firedAt = new Date(entry.firedAt);
    return {
      id: entry.id,
      taskId: entry.taskId,
      title: entry.title,
      priority: task?.priority ?? "medium",
      scheduledFor: entry.scheduledFor,
      firedAt: entry.firedAt,
      minutesAgo: Math.round((now.getTime() - firedAt.getTime()) / 60_000),
    };
  });

  const upcoming: UpcomingReminder[] = tasks
    .filter((task) => (task.status === "todo" || task.status === "in_progress") && task.remindAt != null)
    .sort((a, b) => a.remindAt!.getTime() - b.remindAt!.getTime())
    .slice(0, 12)
    .map((task) => ({
      taskId: task.id,
      title: task.title,
      priority: task.priority,
      remindAt: task.remindAt!.toISOString(),
      repeat: task.repeat,
      minutesUntil: Math.max(0, Math.round((task.remindAt!.getTime() - now.getTime()) / 60_000)),
    }));

  return { due, upcoming };
}

export async function dismissReminder(taskId: string): Promise<number> {
  let toggled = 0;
  await queueWriteLog((entries) => {
    for (const entry of entries) {
      if (entry.taskId === taskId && !entry.dismissed) {
        entry.dismissed = true;
        toggled += 1;
      }
    }
    return entries;
  });
  return toggled;
}