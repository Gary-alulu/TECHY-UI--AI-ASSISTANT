import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Meeting, MeetingPatch } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const MEETINGS_FILE = path.join(DATA_DIR, "meetings.json");

type StoredMeeting = Meeting;

function toStored(entry: StoredMeeting): Meeting {
  return { ...entry };
}

async function readStore(): Promise<StoredMeeting[]> {
  try {
    const raw = await fs.readFile(MEETINGS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let writeQueue: Promise<unknown> = Promise.resolve();

function queueWrite(updater: (store: StoredMeeting[]) => StoredMeeting[]): Promise<StoredMeeting[]> {
  const run = writeQueue.then(async () => {
    const next = updater(await readStore());
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(MEETINGS_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
  writeQueue = run.catch(() => {});
  return run;
}

function cleanString(value?: string): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned.slice(0, 300) : undefined;
}

function cleanList(values?: string[]): string[] {
  return (values ?? [])
    .map((value) => value.trim().slice(0, 300))
    .filter(Boolean)
    .slice(0, 30);
}

export async function getMeetings(): Promise<Meeting[]> {
  return (await readStore())
    .map(toStored)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const found = (await readStore()).find((entry) => entry.id === id);
  return found ? toStored(found) : null;
}

export async function addMeeting(input: {
  title: string;
  date?: string;
  location?: string;
  participants?: string[];
  agenda?: string[];
}): Promise<Meeting> {
  const title = cleanString(input.title);
  if (!title) throw new Error("Meeting title is required");

  const now = new Date().toISOString();
  const list = await queueWrite((store) => {
    store.push({
      id: randomUUID(),
      title,
      date: input.date ?? new Date().toISOString(),
      status: "planned",
      location: cleanString(input.location),
      participants: cleanList(input.participants),
      agenda: cleanList(input.agenda),
      notes: "",
      actionItems: [],
      keyDecisions: [],
      summary: "",
      followUp: [],
      createdAt: now,
      updatedAt: now,
    });
    return store;
  });
  return toStored(list[list.length - 1]);
}

export async function updateMeeting(id: string, patch: MeetingPatch): Promise<Meeting | null> {
  const list = await queueWrite((store) => {
    const entry = store.find((item) => item.id === id);
    if (!entry) return store;
    if (typeof patch.title === "string") entry.title = patch.title.trim().slice(0, 300);
    if (typeof patch.date === "string") entry.date = patch.date;
    if (patch.status && ["planned", "active", "completed"].includes(patch.status)) entry.status = patch.status;
    if (typeof patch.location === "string") entry.location = patch.location.trim() || undefined;
    if (patch.participants !== undefined) entry.participants = cleanList(patch.participants);
    if (Array.isArray(patch.agenda)) entry.agenda = cleanList(patch.agenda);
    if (typeof patch.notes === "string") entry.notes = patch.notes.slice(0, 50_000);
    if (Array.isArray(patch.actionItems)) entry.actionItems = patch.actionItems.slice(0, 80);
    if (Array.isArray(patch.keyDecisions)) entry.keyDecisions = cleanList(patch.keyDecisions);
    if (typeof patch.summary === "string") entry.summary = patch.summary.slice(0, 20_000);
    if (Array.isArray(patch.followUp)) entry.followUp = patch.followUp.slice(0, 80);
    if (typeof patch.durationSeconds === "number") entry.durationSeconds = Math.max(0, Math.round(patch.durationSeconds));
    entry.updatedAt = new Date().toISOString();
    return store;
  });
  const updated = list.find((item) => item.id === id);
  return updated ? toStored(updated) : null;
}

export async function deleteMeeting(id: string): Promise<boolean> {
  let existed = false;
  await queueWrite((store) => {
    const filtered = store.filter((item) => item.id !== id);
    existed = store.length !== filtered.length;
    return filtered;
  });
  return existed;
}

/** Deterministic, model-free meeting summary built from notes + agenda + decisions. */
export async function summarizeMeetingNotes(meeting: Meeting): Promise<{ summary: string; decisions: string[] }> {
  const notes = meeting.notes.trim();
  const decisions = meeting.keyDecisions.length > 0 ? meeting.keyDecisions : extractSentences(notes, 4);
  const topics = meeting.agenda.length > 0 ? meeting.agenda.join(", ") : "general discussion";

  const lines = [
    `MEETING SUMMARY — ${meeting.title}`,
    "──────────────",
    `Agenda: ${topics}`,
    ...(notes ? [`Notes: ${notes.slice(0, 2000)}`] : [`Notes: none recorded during the meeting.`]),
    `Key decisions: ${decisions.join(" · ") || "no explicit decisions recorded"}`,
    `Open action items: ${meeting.actionItems.filter((item) => !item.done).length}`,
  ];
  return { summary: lines.join("\n"), decisions };
}

function extractSentences(text: string, count: number): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 12);
  return sentences.slice(0, count);
}