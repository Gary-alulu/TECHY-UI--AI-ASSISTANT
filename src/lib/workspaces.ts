import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { WorkspaceLayout, WorkspaceSlot } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const WORKSPACES_FILE = path.join(DATA_DIR, "workspaces.json");

const POSITIONS = ["left", "right", "secondary", "bottom", "overlay"] as const;

async function readStore(): Promise<WorkspaceLayout[]> {
  try {
    const raw = await fs.readFile(WORKSPACES_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let writeQueue: Promise<unknown> = Promise.resolve();

function queueWrite(updater: (store: WorkspaceLayout[]) => WorkspaceLayout[]): Promise<WorkspaceLayout[]> {
  const run = writeQueue.then(async () => {
    const next = updater(await readStore());
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(WORKSPACES_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
  writeQueue = run.catch(() => {});
  return run;
}

export async function getWorkspaces(): Promise<WorkspaceLayout[]> {
  return (await readStore()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getWorkspace(id: string): Promise<WorkspaceLayout | null> {
  const found = (await readStore()).find((entry) => entry.id === id);
  return found ?? null;
}

function cleanSlots(slots: WorkspaceSlot[]): WorkspaceSlot[] {
  return slots
    .map((slot) => ({
      id: slot.id || randomUUID(),
      appId: slot.appId || undefined,
      appName: (slot.appName ?? "").trim().slice(0, 80) || undefined,
      position: POSITIONS.includes(slot.position) ? slot.position : ("overlay" as const),
      display: (slot.display ?? "DISPLAY 1").trim().slice(0, 40),
    }))
    .filter((slot) => slot.appName || slot.appId)
    .slice(0, 24);
}

export async function addWorkspace(input: { name: string; description?: string; slots: WorkspaceSlot[] }): Promise<WorkspaceLayout> {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("Workspace name is required");
  const now = new Date().toISOString();
  const layout: WorkspaceLayout = {
    id: randomUUID(),
    name,
    description: input.description?.trim().slice(0, 200) || undefined,
    slots: cleanSlots(input.slots ?? []),
    createdAt: now,
    updatedAt: now,
  };
  await queueWrite((store) => {
    store.push(layout);
    return store;
  });
  return layout;
}

export async function updateWorkspace(id: string, patch: Partial<Pick<WorkspaceLayout, "name" | "description" | "slots">>): Promise<WorkspaceLayout | null> {
  const list = await queueWrite((store) => {
    const entry = store.find((item) => item.id === id);
    if (!entry) return store;
    if (typeof patch.name === "string" && patch.name.trim()) entry.name = patch.name.trim().slice(0, 80);
    if (typeof patch.description === "string") entry.description = patch.description.trim().slice(0, 200) || undefined;
    if (Array.isArray(patch.slots)) entry.slots = cleanSlots(patch.slots);
    entry.updatedAt = new Date().toISOString();
    return store;
  });
  return list.find((item) => item.id === id) ?? null;
}

export async function deleteWorkspace(id: string): Promise<boolean> {
  let existed = false;
  await queueWrite((store) => {
    const filtered = store.filter((item) => item.id !== id);
    existed = store.length !== filtered.length;
    return filtered;
  });
  return existed;
}
