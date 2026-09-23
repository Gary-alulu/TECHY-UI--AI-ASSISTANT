import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ActivityEvent, ActivityKind } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const ACTIVITY_FILE = path.join(DATA_DIR, "activity.json");
const MAX_ENTRIES = 500;

let writeQueue: Promise<unknown> = Promise.resolve();

async function readStore(): Promise<StoredEvent[]> {
  try {
    const raw = await fs.readFile(ACTIVITY_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface StoredEvent {
  id: string;
  ts: string;
  actor: ActivityEvent["actor"];
  kind: ActivityKind;
  action: string;
  detail: string;
  meta?: Record<string, unknown>;
}

function queueWrite(updater: (store: StoredEvent[]) => StoredEvent[]): Promise<StoredEvent[]> {
  const run = writeQueue.then(async () => {
    const next = updater(await readStore());
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(ACTIVITY_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
  writeQueue = run.catch(() => {});
  return run;
}

function toStored(entry: StoredEvent): ActivityEvent {
  return { id: entry.id, ts: new Date(entry.ts).toISOString(), actor: entry.actor, kind: entry.kind, action: entry.action, detail: entry.detail, meta: entry.meta };
}

/** Records one event (respects the global activity-log switch via lib/security). */
export async function logActivity(entry: { actor: "user" | "techy" | "automation"; kind: ActivityKind; action: string; detail: string; meta?: Record<string, unknown> }): Promise<void> {
  try {
    const { getSecurityPolicy } = await import("@/lib/security");
    const policy = await getSecurityPolicy();
    if (!policy.logActivity) return;
  } catch {
    // no security policy yet — keep logging
  }
  await queueWrite((store) => {
    store.unshift({ id: randomUUID(), ts: new Date().toISOString(), ...entry, meta: entry.meta });
    return store.slice(0, MAX_ENTRIES);
  });
}

export async function getActivity(options: { kind?: ActivityKind; limit?: number } = {}): Promise<ActivityEvent[]> {
  return (await readStore())
    .filter((entry) => (options.kind ? entry.kind === options.kind : true))
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, options.limit ?? 100)
    .map(toStored);
}

export async function clearActivity(): Promise<void> {
  await queueWrite(() => []);
}