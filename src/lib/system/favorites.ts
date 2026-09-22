import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const FAVORITES_FILE = path.join(DATA_DIR, "favorites.json");

export interface FavoriteEntry {
  path: string;
  name: string;
  kind: "file" | "directory";
  addedAt: string;
}

let queue: Promise<unknown> = Promise.resolve();

function queueWrite(operation: (list: FavoriteEntry[]) => Promise<void> | void): Promise<void> {
  const run = queue.then(async () => {
    let list: FavoriteEntry[] = [];
    try {
      const raw = await fs.readFile(FAVORITES_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      // fresh start
    }
    await operation(list);
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(FAVORITES_FILE, JSON.stringify(list, null, 2), "utf8");
    } catch {
      // best effort
    }
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function listFavorites(): Promise<FavoriteEntry[]> {
  try {
    const raw = await fs.readFile(FAVORITES_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addFavorite(input: { path: string; name: string; kind: FavoriteEntry["kind"] }): Promise<FavoriteEntry[]> {
  let addedList: FavoriteEntry[] = [];
  await queueWrite((list) => {
    const exists = list.some((entry) => path.resolve(entry.path) === path.resolve(input.path));
    if (!exists) {
      list.unshift({ path: input.path, name: input.name, kind: input.kind, addedAt: new Date().toISOString() });
    }
    addedList = list;
  });
  return addedList;
}

export async function removeFavorite(target: string): Promise<FavoriteEntry[]> {
  let nextList: FavoriteEntry[] = [];
  await queueWrite((list) => {
    list = list.length > 0 ? list : [];
    const filtered = list.filter((entry) => path.resolve(entry.path) !== path.resolve(target));
    nextList = filtered;
    // replace contents of the array so the same reference writes back
    list.length = 0;
    for (const entry of filtered) list.push(entry);
  });
  return nextList;
}

export function isCursorFavorite(list: FavoriteEntry[], target: string): boolean {
  return list.some((entry) => path.resolve(entry.path) === path.resolve(target));
}