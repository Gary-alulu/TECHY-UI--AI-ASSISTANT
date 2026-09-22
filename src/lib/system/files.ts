import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { FileEntry } from "@/types";

export const WORKSPACE_ROOT = process.cwd();

export type FilesScope = "system" | "device";

const MAX_ENTRIES = 1500;

export class OutsideWorkspaceError extends Error {
  constructor(message = "Path is outside the workspace") {
    super(message);
    this.name = "OutsideWorkspaceError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export interface DirectoryListing {
  scope: FilesScope;
  /** Absolute navigation anchor: workspace root (system) or active drive root (device). Empty in the device drive menu. */
  root: string;
  /** Absolute current directory. Empty in the device drive menu. */
  path: string;
  name: string;
  parent: string | null;
  roots: string[];
  entries: FileEntry[];
  truncated: boolean;
}

interface DriveInfo {
  deviceID: string;
  label: string;
  size: number;
}

interface RawDrive {
  DeviceID?: string;
  VolumeName?: string;
  Size?: number;
}

let driveCache: { at: number; drives: DriveInfo[] } | null = null;

/**
 * Enumerates fixed/removable volumes via CIM on Windows (cached for 60s).
 * Uses the same bounded-spawn pattern as app launching so a hung PowerShell
 * cannot block the request forever.
 */
async function enumerateDrives(): Promise<DriveInfo[]> {
  if (process.platform !== "win32") return [];
  if (driveCache && Date.now() - driveCache.at < 60_000) return driveCache.drives;

  const script =
    "Get-CimInstance Win32_LogicalDisk -Filter 'DriveType = 3 or DriveType = 2' | Select-Object DeviceID, VolumeName, Size | ConvertTo-Json -Compress";

  const out = await new Promise<string>((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Drive enumeration timed out"));
    }, 8000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(stderr.trim() || `PowerShell exited with ${code}`));
      else resolve(stdout);
    });
  });

  const parsed = JSON.parse(out) as RawDrive | RawDrive[] | null;
  const raw = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  const drives = raw
    .map((entry) => ({
      deviceID: String(entry.DeviceID ?? ""),
      label: String(entry.VolumeName ?? ""),
      size: Number(entry.Size) || 0,
    }))
    .filter((entry) => /^[a-zA-Z]:$/.test(entry.deviceID));

  driveCache = { at: Date.now(), drives };
  return drives;
}

/**
 * System scope: confines every request to the workspace subtree. The check
 * compares against the real `path.resolve` root so `..` hops or absolute paths
 * to other drives cannot escape, regardless of separator style.
 */
export function resolveSystemTarget(input: string): string {
  const root = path.resolve(WORKSPACE_ROOT);
  const target = input === "" ? root : path.resolve(root, input);
  const rel = path.relative(root, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new OutsideWorkspaceError();
  }
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new OutsideWorkspaceError();
  }
  return target;
}

/**
 * Device scope: whole-machine browsing. Absolute paths resolve against their
 * own drive; a missing volume root (like a bare `C:` without `\`) is rejected.
 * Absolute paths cannot climb above a drive root, so no extra guard is needed.
 */
export function resolveDeviceTarget(input: string): string {
  if (input.trim() === "") return "";
  if (!path.isAbsolute(input)) {
    throw new OutsideWorkspaceError("An absolute path is required in device scope");
  }
  return path.resolve(input);
}

async function statEntry(fullPath: string): Promise<{ size?: number; modifiedAt?: Date }> {
  try {
    const st = await fs.stat(fullPath);
    return { size: st.size, modifiedAt: st.mtime };
  } catch {
    return {};
  }
}

async function readEntries(target: string): Promise<{ entries: FileEntry[]; truncated: boolean }> {
  const dirents = await fs.readdir(target, { withFileTypes: true });
  const sorted = dirents
    .map((d) => ({ name: d.name, isDirectory: d.isDirectory() }))
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });

  const truncated = sorted.length > MAX_ENTRIES;
  const visible = truncated ? sorted.slice(0, MAX_ENTRIES) : sorted;

  const entries: FileEntry[] = [];
  for (const item of visible) {
    const full = path.join(target, item.name);
    if (item.isDirectory) {
      entries.push({ name: item.name, path: full, type: "directory" });
      continue;
    }
    const extension = path.extname(item.name).slice(1).toLowerCase() || undefined;
    const { size, modifiedAt } = await statEntry(full);
    entries.push({ name: item.name, path: full, type: "file", extension, size, modifiedAt });
  }
  return { entries, truncated };
}

async function listSystem(input: string): Promise<DirectoryListing> {
  const root = path.resolve(WORKSPACE_ROOT);
  const target = resolveSystemTarget(input);

  let stat;
  try {
    stat = await fs.stat(target);
  } catch {
    throw new NotFoundError("Path does not exist");
  }
  if (!stat.isDirectory()) throw new NotFoundError("Path is not a directory");

  let roots: string[] = [];
  if (target === root) {
    const topLevel = await fs.readdir(target, { withFileTypes: true });
    roots = topLevel
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }

  const { entries, truncated } = await readEntries(target);

  let parent: string | null = null;
  if (target !== root) {
    const dirname = path.dirname(target);
    const rel = path.relative(root, dirname);
    if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) {
      parent = dirname;
    }
  }

  return {
    scope: "system",
    root,
    path: target,
    name: target === root ? "Workspace" : path.basename(target),
    parent,
    roots,
    entries,
    truncated,
  };
}

async function listDevice(input: string): Promise<DirectoryListing> {
  const target = resolveDeviceTarget(input);

  if (target === "") {
    const drives = await enumerateDrives();
    const entries: FileEntry[] = drives
      .map(
        (drive): FileEntry => ({
          name: drive.label ? `${drive.label} (${drive.deviceID})` : drive.deviceID,
          path: `${drive.deviceID}\\`,
          type: "directory",
          size: drive.size || undefined,
        })
      )
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    return {
      scope: "device",
      root: "",
      path: "",
      name: "This PC",
      parent: null,
      roots: entries.map((entry) => entry.path),
      entries,
      truncated: false,
    };
  }

  const root = path.parse(target).root;

  let stat;
  try {
    stat = await fs.stat(target);
  } catch {
    throw new NotFoundError("Path does not exist");
  }
  if (!stat.isDirectory()) throw new NotFoundError("Path is not a directory");

  const { entries, truncated } = await readEntries(target);
  const parent = target === root ? "" : path.dirname(target);

  return {
    scope: "device",
    root,
    path: target,
    name: target === root ? root.replace(/[\\/]+$/, "") : path.basename(target),
    parent,
    roots: [],
    entries,
    truncated,
  };
}

export async function listDirectory(input = "", scope: FilesScope = "system"): Promise<DirectoryListing> {
  return scope === "device" ? listDevice(input) : listSystem(input);
}