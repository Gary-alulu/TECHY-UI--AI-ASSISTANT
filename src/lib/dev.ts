import { execFile, spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import type { DeveloperSnapshot, DevLogEntry, DevPortInfo } from "@/types";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();

async function git(args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd: ROOT, timeout: 5000, windowsHide: true });
    return stdout.trim();
  } catch {
    return null;
  }
}

async function readPackage(): Promise<{ name: string; scripts: Array<{ name: string; command: string }> }> {
  try {
    const raw = await fs.readFile(path.join(ROOT, "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { name?: string; scripts?: Record<string, string> };
    return {
      name: parsed.name ?? "unknown",
      scripts: Object.entries(parsed.scripts ?? {}).map(([name, command]) => ({ name, command })),
    };
  } catch {
    return { name: "unknown", scripts: [] };
  }
}

const LOG_GLOBS = [/^preview(?:-\d*)?\.log$/i, /^(dev|start|build|next)-?\d*\.log$/i, /^.*\.log$/i];

async function collectLogs(): Promise<DevLogEntry[]> {
  const entries: DevLogEntry[] = [];
  try {
    const files = await fs.readdir(ROOT);
    for (const file of files) {
      if (LOG_GLOBS.some((regex) => regex.test(file))) {
        try {
          const raw = await fs.readFile(path.join(ROOT, file), "utf8");
          const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0).slice(-80);
          entries.push({ file, lines });
        } catch {
          // unreadable log
        }
      }
    }
  } catch {
    // no logs
  }
  return entries;
}

function execCommand(command: string, args: string[]): string {
  try {
    const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true, timeout: 5000 });
    return (result.stdout ?? "").toString();
  } catch {
    return "";
  }
}

/** Snapshot of listening TCP ports mapped to owning process names (win32-aware). */
export function listLocalPorts(): DevPortInfo[] {
  const isWindows = os.platform() === "win32";
  const pidNames = new Map<number, string>();
  if (isWindows) {
    try {
      const tasklist = execCommand("tasklist", ["/FO", "CSV", "/NH"]);
      for (const line of tasklist.split(/\r?\n/)) {
        if (!line.includes(",")) continue;
        const parts = line.replace(/^"|"$/g, "").split('","');
        if (parts.length >= 2) {
          const name = parts[0].replace(/"/g, "").trim();
          const pid = Number(parts[1].replace(/"/g, "").trim());
          if (name && Number.isFinite(pid)) pidNames.set(pid, name);
        }
      }
    } catch {
      // tasklist unavailable
    }
  }
  const parsed: DevPortInfo[] = [];
  const netstat = execCommand("netstat", ["-ano"]);
  for (const line of netstat.split(/\r?\n/)) {
    const match = line.trim().match(/^(TCP|UDP)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d+)$/);
    if (!match) continue;
    const [proto, local, , state, pidRaw] = [match[1], match[2], match[3], match[4], match[5]];
    const portMatch = local.match(/:(\d+)$/);
    if (!portMatch) continue;
    const port = Number(portMatch[1]);
    const pid = Number(pidRaw);
    if (!Number.isFinite(port)) continue;
    if (state === "LISTENING" || proto === "UDP") {
      parsed.push({ proto, address: local.replace(/:\d+$/, ""), port, pid, process: pidNames.get(pid) ?? "—" });
    }
  }
  return parsed.sort((a, b) => a.port - b.port).slice(0, 30);
}

function countNodeProcesses(): number {
  const isWindows = os.platform() === "win32";
  const result = execCommand(isWindows ? "tasklist" : "ps", isWindows ? ["/FI", "IMAGENAME eq node.exe", "/NH"] : ["-e", "-o", "comm="]);
  return result.split(/\r?\n/).filter((line) => /node/i.test(line)).length;
}

export async function getDeveloperSnapshot(): Promise<DeveloperSnapshot> {
  const [branch, statusOut, commits, pkg] = await Promise.all([
    git(["branch", "--show-current"]),
    git(["status", "--porcelain"]),
    git(["log", "--oneline", "-6"]),
    readPackage(),
  ]);
  const statusLines = (statusOut ?? "").split("\n").filter((line) => line.length > 0);
  return {
    branch: branch ?? "no repository",
    status: statusLines.length,
    statusLines: statusLines.slice(0, 30),
    recentCommits: (commits ?? "").split("\n").filter((line) => line.length > 0),
    packageName: pkg.name,
    scripts: pkg.scripts,
    ports: listLocalPorts(),
    logs: await collectLogs(),
    nodeProcesses: countNodeProcesses(),
  };
}