import { promises as fs } from "node:fs";
import path from "node:path";
import type { SafeModeCapability, SafeModeState } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const SAFEMODE_FILE = path.join(DATA_DIR, "safemode.json");

export const SAFE_MODE_CAPABILITIES: Array<{ key: SafeModeCapability; label: string; description: string }> = [
  { key: "chat", label: "AI Chat", description: "Plain conversation with TECHY." },
  { key: "fileRead", label: "File Reading", description: "Reading and preparing local files." },
  { key: "systemMonitor", label: "System Monitoring", description: "Reporting CPU, RAM, disks and processes." },
  { key: "fileModify", label: "File Modification", description: "Renaming, moving or deleting files." },
  { key: "appControl", label: "App Control", description: "Launching, closing or arranging applications." },
  { key: "terminal", label: "Terminal", description: "Running commands and scripts." },
  { key: "automation", label: "Automation", description: "Executing saved workflows." },
];

function emptyState(): SafeModeState {
  return {
    active: false,
    enabledAt: null,
    capabilities: {
      chat: true,
      fileRead: true,
      systemMonitor: true,
      fileModify: false,
      appControl: false,
      terminal: false,
      automation: false,
    },
  };
}

async function readState(): Promise<SafeModeState> {
  try {
    const raw = await fs.readFile(SAFEMODE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<SafeModeState>;
    const base = emptyState();
    return {
      active: parsed.active === true,
      enabledAt: typeof parsed.enabledAt === "string" ? parsed.enabledAt : null,
      capabilities: { ...base.capabilities, ...(parsed.capabilities ?? {}) },
    };
  } catch {
    return emptyState();
  }
}

let writeQueue: Promise<unknown> = Promise.resolve();

function queueWrite(updater: (state: SafeModeState) => SafeModeState): Promise<SafeModeState> {
  const run = writeQueue.then(async () => {
    const next = updater(await readState());
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(SAFEMODE_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
  writeQueue = run.catch(() => {});
  return run;
}

export async function getSafeMode(): Promise<SafeModeState> {
  return readState();
}

export async function setSafeMode(active: boolean): Promise<SafeModeState> {
  const state = await queueWrite((current) => ({
    ...current,
    active,
    enabledAt: active ? new Date().toISOString() : current.enabledAt,
  }));
  const { logActivity } = await import("@/lib/activity");
  await logActivity({
    actor: active ? "user" : "techy",
    kind: "security",
    action: active ? "Safe Mode activated" : "Safe Mode deactivated",
    detail: active
      ? "All computer-control capabilities are disabled."
      : "Computer-control capabilities restored.",
  });
  return state;
}

export async function setSafeCapability(capability: SafeModeCapability, allowed: boolean): Promise<SafeModeState> {
  return queueWrite((current) => ({
    ...current,
    capabilities: { ...current.capabilities, [capability]: allowed },
  }));
}

/** True when safe mode blocks a specific capability. */
export async function safeModeBlocks(capability: SafeModeCapability): Promise<boolean> {
  const state = await readState();
  return state.active && state.capabilities[capability] === false;
}