import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { PluginCategory, PluginDef } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const PLUGINS_FILE = path.join(DATA_DIR, "plugins.json");

export const PLUGIN_GROUPS: Array<{ label: string; tools: string[] }> = [
  { label: "Core Tools", tools: ["get_briefing", "get_calendar", "create_event", "prepare_meeting", "run_automation", "create_task", "complete_task"] },
  { label: "File Tools", tools: ["search_files", "list_directory", "read_document", "search_knowledge"] },
  { label: "System Tools", tools: ["get_system_metrics", "get_top_processes", "get_system_summary", "get_storage", "get_temps", "get_battery"] },
  { label: "Browser Tools", tools: [] },
  { label: "Developer Tools", tools: ["get_developer_snapshot", "inspect_image"] },
  { label: "Creative Tools", tools: ["find_apps_by_category", "open_application"] },
];

export const BUILTIN_PERMISSIONS: Record<string, string[]> = {
  read: ["fileAccess"],
  write: ["fileAccess", "deleteFiles"],
  launch: ["appLaunch"],
  execute: ["terminal"],
  configure: ["systemSettings"],
  network: ["network"],
};

let writeQueue: Promise<unknown> = Promise.resolve();

async function readStore(): Promise<InstalledPlugin[]> {
  try {
    const raw = await fs.readFile(PLUGINS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function queueWrite(updater: (store: InstalledPlugin[]) => InstalledPlugin[]): Promise<InstalledPlugin[]> {
  const run = writeQueue.then(async () => {
    const next = updater(await readStore());
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(PLUGINS_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
  writeQueue = run.catch(() => {});
  return run;
}

interface InstalledPlugin {
  id: string;
  name: string;
  description: string;
  category: PluginCategory;
  permissions: string[];
  inputs: string[];
  outputs: string[];
  enabled: boolean;
  execute?: PluginDef["execute"];
  installedAt: string;
}

function toDef(entry: InstalledPlugin, builtin = false): PluginDef {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    category: entry.category,
    permissions: entry.permissions,
    inputs: entry.inputs,
    outputs: entry.outputs,
    enabled: entry.enabled,
    builtin,
    execute: entry.execute,
  };
}

const BUILTIN_PLUGINS: PluginDef[] = [
  { id: "core.briefing", name: "Daily Briefing", description: "Combines calendar, tasks, system and file signals into a configurable morning report.", category: "Core", permissions: ["fileAccess", "systemSettings"], inputs: ["date"], outputs: ["briefing"], enabled: true },
  { id: "core.automation", name: "Automation Engine", description: "Runs WHEN/THEN workflows on schedule, watch folders or manual trigger.", category: "Core", permissions: ["fileAccess", "appLaunch", "terminal"], inputs: ["trigger", "actions"], outputs: ["run"], enabled: true },
  { id: "file.search", name: "Workspace Search", description: "Keyword and content search across the workspace and knowledge base.", category: "File", permissions: ["fileAccess"], inputs: ["query"], outputs: ["matches"], enabled: true },
  { id: "file.prep", name: "Meeting Prep", description: "Gathers notes, proposals, folders and images relevant to a calendar event.", category: "File", permissions: ["fileAccess"], inputs: ["event"], outputs: ["findings"], enabled: true },
  { id: "system.metrics", name: "Live Metrics", description: "CPU, RAM, GPU, temperatures, storage and battery from the OS.", category: "System", permissions: ["fileAccess"], inputs: [], outputs: ["metrics"], enabled: true },
  { id: "system.processes", name: "Process Viewer", description: "Top processes and listening local ports.", category: "System", permissions: ["fileAccess"], inputs: ["limit"], outputs: ["processes"], enabled: true },
  { id: "dev.git", name: "Git Inspector", description: "Branch, status and recent commit health for the workspace repository.", category: "Developer", permissions: ["fileAccess", "terminal"], inputs: ["path"], outputs: ["git"], enabled: true },
  { id: "dev.logs", name: "Log Tail", description: "Latest server and build log output for debugging failures.", category: "Developer", permissions: ["fileAccess"], inputs: ["files"], outputs: ["lines"], enabled: true },
  { id: "creative.artwork", name: "Artwork Inspector", description: "Reads image dimensions, resolution, color palette and print readiness.", category: "Creative", permissions: ["fileAccess"], inputs: ["image"], outputs: ["inspection"], enabled: true },
];

export async function listPlugins(): Promise<PluginDef[]> {
  const installed = await readStore();
  return [...BUILTIN_PLUGINS, ...installed.map((entry) => toDef(entry))];
}

export async function installPlugin(def: { name: string; description: string; category: PluginCategory; permissions: string[]; inputs: string[]; outputs: string[]; execute: NonNullable<PluginDef["execute"]> }): Promise<PluginDef> {
  const plugin: InstalledPlugin = {
    id: `${randomUUID().slice(0, 8)}.${def.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`,
    name: def.name.trim(),
    description: def.description.trim(),
    category: def.category,
    permissions: def.permissions,
    inputs: def.inputs,
    outputs: def.outputs,
    enabled: true,
    execute: def.execute,
    installedAt: new Date().toISOString(),
  };
  if (!plugin.name) throw new Error("Plugin name is required");
  const list = await queueWrite((store) => [...store, plugin]);
  return toDef(list[list.length - 1]);
}

export async function setPluginEnabled(id: string, enabled: boolean): Promise<PluginDef | null> {
  const list = await queueWrite((store) => {
    const target = store.find((entry) => entry.id === id);
    if (target) target.enabled = enabled;
    return store;
  });
  const updated = list.find((entry) => entry.id === id);
  return updated ? toDef(updated) : null;
}

export async function removePlugin(id: string): Promise<boolean> {
  let existed = false;
  await queueWrite((store) => {
    const filtered = store.filter((entry) => entry.id !== id);
    existed = store.length !== filtered.length;
    return filtered;
  });
  return existed;
}

export async function runPlugin(id: string): Promise<{ output: string; action: string }> {
  const installed = await readStore();
  const plugin = installed.find((entry) => entry.id === id && entry.enabled);
  if (!plugin) return { output: "", action: "Plugin not found or disabled" };
  if (!plugin.execute) return { output: "", action: "No execute behaviour" };

  const { getSecurityPolicy, resolvePermission, PERMISSION_RANK, CATEGORY_LABELS } = await import("@/lib/security");
  const policy = await getSecurityPolicy();

  const categories = CATEGORY_LABELS.map((entry) => entry.key);
  for (const permission of plugin.permissions) {
    for (const category of categories) {
      if (permission.endsWith(category)) {
        const level = resolvePermission(category, policy);
        if (PERMISSION_RANK[level] < 3) {
          return { output: "", action: `Blocked: permission "${permission}" requires level "allowed" (policy is "${level}")` };
        }
      }
    }
  }

  if (plugin.execute.action === "notify") {
    const { addNotification } = await import("@/lib/notifications");
    await addNotification({ kind: "ai_task", title: plugin.execute.message ?? plugin.name, body: `Plugin "${plugin.name}" ran.`, source: "plugin" });
    return { output: plugin.execute.message ?? `Plugin "${plugin.name}" notified.`, action: "notify" };
  }
  if (plugin.execute.action === "tool" && plugin.execute.tool) {
    const { executeTool } = await import("@/lib/ai/tools");
    const result = await executeTool(plugin.execute.tool, plugin.execute.args ?? {});
    return { output: result.ok ? result.output : result.error ?? "", action: `tool:${plugin.execute.tool}` };
  }
  return { output: plugin.execute.output ?? `Plugin "${plugin.name}" completed.`, action: "text" };
}