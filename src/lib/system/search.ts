import { promises as fs } from "node:fs";
import path from "node:path";
import type { FileEntry } from "@/types";
import { OutsideWorkspaceError, WORKSPACE_ROOT } from "./files";
import { TEXT_EXTENSIONS } from "./documents";

export interface SearchResult {
  path: string;
  name: string;
  type: "file" | "directory";
  size?: number;
  modifiedAt?: string;
  matched: "name" | "content";
}

export interface SearchOptions {
  query: string;
  scope: "system" | "device";
  root?: string;
}

const MAX_RESULTS = 200;
const MAX_VISITED = 25_000;
const MAX_DEPTH = 9;
const MAX_CONTENT_READS = 600;
const MAX_CONTENT_BYTES = 1024 * 1024;

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "$Recycle.Bin",
  "System Volume Information",
  "Windows",
  "Program Files",
  "Program Files (x86)",
  "AppData",
]);

function isSkippableDir(name: string, depth: number): boolean {
  if (depth > 0 && name.startsWith(".")) return true;
  return SKIP_DIRS.has(name);
}

function labelForBucket(scope: SearchOptions["scope"], root?: string): string {
  return scope === "system" ? path.resolve(WORKSPACE_ROOT) : root && path.isAbsolute(root) ? path.resolve(root) : "";
}

export async function searchFiles(options: SearchOptions): Promise<{ results: SearchResult[]; truncated: boolean; scanned: number; contentSearched: number }> {
  const query = options.query.trim();
  const root = labelForBucket(options.scope, options.root);
  if (!query) return { results: [], truncated: false, scanned: 0, contentSearched: 0 };

  let ans = path.resolve(WORKSPACE_ROOT);
  if (options.scope === "system") {
    const trimmed = root.startsWith(ans) ? root : ans;
    ans = trimmed;
  } else if (root) {
    ans = root;
  }

  const needle = query.toLowerCase();
  const results: SearchResult[] = [];
  const scanned = { count: 0 };
  const contentReads = { count: 0 };
  let truncated = false;
  const contentSearchEnabled = needle.length >= 3;

  const stack: Array<{ dir: string; rel: string; depth: number }> = [{ dir: ans, rel: "", depth: 0 }];

  while (stack.length > 0) {
    const { dir, depth } = stack.pop()!;
    if (scanned.count >= MAX_VISITED) {
      truncated = true;
      break;
    }

    let dirents: Array<{ name: string; isDirectory: boolean; isSymbolicLink: boolean }>;
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true }).then((entries) =>
        entries.map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory(), isSymbolicLink: entry.isSymbolicLink() }))
      );
    } catch {
      continue;
    }

    for (const item of dirents) {
      if (scanned.count >= MAX_VISITED) {
        truncated = true;
        break;
      }
      scanned.count += 1;

      if (item.isDirectory) {
        if (isSkippableDir(item.name, depth)) continue;
        if (depth >= MAX_DEPTH) continue;
        const child = path.join(dir, item.name);
        if (needle && item.name.toLowerCase().includes(needle) && results.length < MAX_RESULTS) {
          results.push({ path: child, name: item.name, type: "directory", matched: "name" });
        }
        stack.push({ dir: child, rel: "", depth: depth + 1 });
        continue;
      }

      if (item.isSymbolicLink) continue;

      const full = path.join(dir, item.name);
      if (results.length >= MAX_RESULTS) {
        truncated = true;
        break;
      }

      const nameMatch = item.name.toLowerCase().includes(needle);
      if (nameMatch) {
        const st = await tryStat(full);
        results.push({ path: full, name: item.name, type: "file", matched: "name", ...(st.size != null ? { size: st.size } : {}), ...(st.modifiedAt ? { modifiedAt: st.modifiedAt } : {}) });
        continue;
      }

      if (contentSearchEnabled && contentReads.count < MAX_CONTENT_READS && TEXT_EXTENSIONS.test(item.name)) {
        let stat: { size?: number } = {};
        try {
          const st = await fs.stat(full);
          stat = { size: st.size };
        } catch {
          continue;
        }
        if (stat.size != null && stat.size <= MAX_CONTENT_BYTES) {
          contentReads.count += 1;
          try {
            const text = await fs.readFile(full, "utf8");
            if (text.toLowerCase().includes(needle)) {
              results.push({ path: full, name: item.name, type: "file", size: stat.size, matched: "content" });
            }
          } catch {
            // unreadable binary masquerading as text
          }
        }
      }
    }
  }

  const ranked = results.sort((a, b) => {
    if (a.type !== b.type) return a.type === "file" ? -1 : 1;
    if (a.matched !== b.matched) return a.matched === "name" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return { results: ranked, truncated, scanned: scanned.count, contentSearched: contentReads.count };
}

async function tryStat(full: string): Promise<{ size?: number; modifiedAt?: string }> {
  try {
    const st = await fs.stat(full);
    return { size: st.size, modifiedAt: st.mtime.toISOString() };
  } catch {
    return {};
  }
}

export { OutsideWorkspaceError };
export type { FileEntry };