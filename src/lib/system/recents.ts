import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const RECENTS_FILE = path.join(DATA_DIR, "recents.json");
const CAP = 20;

export interface RecentEntry {
  path: string;
  name: string;
  kind: "file" | "directory";
  size?: number;
  openedAt: string;
}

let queue: Promise<unknown> = Promise.resolve();

async function readAll(): Promise<RecentEntry[]> {
  try {
    const raw = await fs.readFile(RECENTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function queueWrite(operation: (list: RecentEntry[]) => RecentEntry[] | void): Promise<void> {
  const run = queue.then(async () => {
    const list = await readAll();
    const result = operation(list);
    const next = result ?? list;
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(RECENTS_FILE, JSON.stringify(next.slice(0, CAP), null, 2), "utf8");
    } catch {
      // best effort
    }
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function listRecents(): Promise<RecentEntry[]> {
  const list = await readAll();
  return list.slice(0, CAP);
}

export async function touchRecent(input: { path: string; name: string; kind: RecentEntry["kind"]; size?: number }): Promise<RecentEntry[]> {
  let nextList: RecentEntry[] = [];
  await queueWrite((list) => {
    const filtered = list.filter((entry) => path.resolve(entry.path) !== path.resolve(input.path));
    filtered.unshift({
      path: input.path,
      name: input.name,
      kind: input.kind,
      ...(input.size != null ? { size: input.size } : {}),
      openedAt: new Date().toISOString(),
    });
    nextList = filtered;
    return filtered;
  });
  return nextList.slice(0, CAP);
}