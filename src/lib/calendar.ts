import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { CalendarEvent } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const CALENDAR_FILE = path.join(DATA_DIR, "calendar.json");

let writeQueue: Promise<unknown> = Promise.resolve();

interface StoredEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  location?: string;
  attendees?: string[];
  notes?: string;
  color?: string;
  preparedAt?: string;
  createdAt: string;
}

export interface CalendarPatch {
  title?: string;
  start?: Date | string;
  end?: Date | string | null;
  location?: string;
  attendees?: string[];
  notes?: string;
  color?: string;
  preparedAt?: Date | string | null;
}

function toDate(value: string): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function toStored(entry: StoredEvent): CalendarEvent {
  return {
    id: entry.id,
    title: entry.title,
    start: toDate(entry.start),
    end: entry.end ? toDate(entry.end) : undefined,
    location: entry.location,
    attendees: entry.attendees,
    notes: entry.notes,
    color: entry.color,
    preparedAt: entry.preparedAt ? toDate(entry.preparedAt) : undefined,
    createdAt: toDate(entry.createdAt),
  };
}

async function readStore(): Promise<StoredEvent[]> {
  try {
    const raw = await fs.readFile(CALENDAR_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function queueWrite(updater: (events: StoredEvent[]) => StoredEvent[]): Promise<StoredEvent[]> {
  const run = writeQueue.then(async () => {
    const next = updater(await readStore());
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(CALENDAR_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
  writeQueue = run.catch(() => {});
  return run;
}

function inRange(event: CalendarEvent, from?: Date, to?: Date): boolean {
  if (from && event.start.getTime() < from.getTime() - 60_000) return false;
  if (to && event.start.getTime() > to.getTime()) return false;
  return true;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

export async function getEvents(options: { from?: Date; to?: Date } = {}): Promise<CalendarEvent[]> {
  return (await readStore())
    .map(toStored)
    .filter((event) => inRange(event, options.from, options.to))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export async function getEvent(id: string): Promise<CalendarEvent | null> {
  const events = await readStore();
  const found = events.find((event) => event.id === id);
  return found ? toStored(found) : null;
}

export async function addEvent(input: {
  title: string;
  start: Date | string;
  end?: Date | string | null;
  location?: string;
  attendees?: string[];
  notes?: string;
  color?: string;
}): Promise<CalendarEvent> {
  const title = input.title.trim();
  const start = toIso(input.start);
  if (!start) throw new Error("Missing start time");
  const list = await queueWrite((events) => {
    events.push({
      id: randomUUID(),
      title,
      start,
      end: toIso(input.end) ?? undefined,
      location: input.location?.trim() || undefined,
      attendees: Array.isArray(input.attendees) ? input.attendees.map((a) => a.trim()).filter(Boolean).slice(0, 20) : undefined,
      notes: input.notes?.trim() || undefined,
      color: input.color?.trim() || undefined,
      createdAt: new Date().toISOString(),
    });
    return events;
  });
  return toStored(list[list.length - 1]);
}

function toIso(value?: Date | string | null): string | undefined {
  if (value == null || value === "") return undefined;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export async function updateEvent(id: string, patch: CalendarPatch): Promise<CalendarEvent | null> {
  const list = await queueWrite((events) => {
    const entry = events.find((event) => event.id === id);
    if (!entry) return events;
    if (typeof patch.title === "string") entry.title = patch.title.trim();
    if (patch.start !== undefined) {
      const iso = toIso(patch.start);
      if (iso) entry.start = iso;
    }
    if (patch.end !== undefined) entry.end = toIso(patch.end) ?? undefined;
    if (typeof patch.location === "string") entry.location = patch.location.trim() || undefined;
    if (patch.attendees !== undefined) entry.attendees = patch.attendees.map((a) => a.trim()).filter(Boolean).slice(0, 20);
    if (typeof patch.notes === "string") entry.notes = patch.notes.trim() || undefined;
    if (typeof patch.color === "string") entry.color = patch.color.trim() || undefined;
    if (patch.preparedAt !== undefined) entry.preparedAt = toIso(new Date()) ?? entry.preparedAt;
    return events;
  });
  const updated = list.find((event) => event.id === id);
  return updated ? toStored(updated) : null;
}

export async function markPrepared(id: string): Promise<CalendarEvent | null> {
  const list = await queueWrite((events) => {
    const entry = events.find((event) => event.id === id);
    if (entry) entry.preparedAt = new Date().toISOString();
    return events;
  });
  const updated = list.find((event) => event.id === id);
  return updated ? toStored(updated) : null;
}

export async function removeEvent(id: string): Promise<boolean> {
  let existed = false;
  await queueWrite((events) => {
    const filtered = events.filter((event) => event.id !== id);
    existed = events.length !== filtered.length;
    return filtered;
  });
  return existed;
}
