import os from "node:os";
import path from "node:path";
import { getCpuUsage, getHardwareInfo, getNetworkInfo, getRamInfo, getStorageInfo, getTopProcesses } from "@/lib/system/hardware";
import { getInstalledApps, launchInstalledApp } from "@/lib/system/apps";
import { listDirectory, resolveDeviceTarget, resolveSystemTarget } from "@/lib/system/files";
import { extractText } from "@/lib/system/documents";

export interface ToolSpec {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolResult {
  ok: boolean;
  output: string;
  error?: string;
}

const TOOL_SPECS: ToolSpec[] = [
  {
    type: "function",
    function: {
      name: "get_system_metrics",
      description: "Return live machine metrics: CPU usage and model, RAM used/total, storage used/total, network upload/download rate, and uptime.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_workspace",
      description: "List the contents of a directory inside the TECHY workspace (the project folder). Defaults to the workspace root. Use name/path in the response to help the user.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Optional absolute path inside the workspace" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_application",
      description: "Launch an installed application on this machine by name, e.g. \"Photoshop\", \"Chrome\", \"VLC\". Fails if the app is not installed or has no launchable executable.",
      parameters: {
        type: "object",
        properties: { app: { type: "string", description: "Application name to open" } },
        required: ["app"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_installed_apps",
      description: "Search the list of installed applications by name or publisher and return up to 20 matches.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Search term" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_processes",
      description: "Return the top CPU-consuming running processes with PID, name and CPU percentage.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number", description: "How many processes, default 10" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_document",
      description:
        "Read the text content of a local file so you can summarize, compare, extract data from, or quote it. Supports text, code, markdown, JSON, CSV, PDF, DOCX and XLSX. Returns up to 12,000 characters.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Absolute path to the document" } },
        required: ["path"],
      },
    },
  },
];

function fmtBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

async function runMetrics(): Promise<ToolResult> {
  try {
    const [hardware, cpu, network, storage] = await Promise.all([
      getHardwareInfo(),
      getCpuUsage(),
      getNetworkInfo(),
      getStorageInfo().catch(() => ({ percentage: 0, usedGB: 0, totalGB: 0, mount: "" })),
    ]);
    const ram = getRamInfo();
    return {
      ok: true,
      output: [
        `${hardware.machine.manufacturer} ${hardware.machine.model} (${hardware.machine.osName})`,
        `CPU: ${cpu.toFixed(1)}% — ${hardware.cpu.model} (${hardware.cpu.cores} cores / ${hardware.cpu.logical} threads)`,
        `RAM: ${ram.usedGB.toFixed(1)} / ${ram.totalGB.toFixed(1)} GB (${ram.percentage.toFixed(1)}%)`,
        `Disk: ${storage.usedGB} / ${storage.totalGB} GB usable (${Math.round(storage.percentage)}% used)`,
        `Network: ↓ ${network.totals.download} ${network.totals.unit} · ↑ ${network.totals.upload} ${network.totals.unit}`,
        `Uptime: ${Math.floor(os.uptime() / 60)} min`,
      ].join("\n"),
    };
  } catch (error) {
    return { ok: false, output: "", error: error instanceof Error ? error.message : "Metrics unavailable" };
  }
}

async function runListWorkspace(args: { path?: string }): Promise<ToolResult> {
  try {
    const listing = await listDirectory(args.path ?? "", "system");
    const lines = listing.entries.slice(0, 60).map((entry) => {
      const size = entry.type === "file" && entry.size != null ? ` (${fmtBytes(entry.size)})` : "";
      return `${entry.type === "directory" ? "[dir] " : ""}${entry.name}${size}`;
    });
    const extra = listing.entries.length > 60 ? `\n... and ${listing.entries.length - 60} more entries` : "";
    return { ok: true, output: `Directory: ${listing.path}\n${lines.join("\n")}${extra}` };
  } catch (error) {
    return { ok: false, output: "", error: error instanceof Error ? error.message : "Cannot list directory" };
  }
}

async function runOpenApp(args: { app?: string }): Promise<ToolResult> {
  const app = args.app?.trim();
  if (!app) return { ok: false, output: "", error: "No app name provided" };
  try {
    const installed = await getInstalledApps();
    const needle = app.toLowerCase();
    const match =
      installed.find((candidate) => candidate.name.toLowerCase() === needle) ??
      installed.find((candidate) => candidate.name.toLowerCase().includes(needle));
    if (!match) {
      const similar = installed
        .filter((candidate) => candidate.name.toLowerCase().includes(needle.slice(0, 3)))
        .slice(0, 5)
        .map((candidate) => candidate.name);
      return { ok: false, output: "", error: `Application not found.${similar.length ? ` Did you mean: ${similar.join(", ")}?` : ""}` };
    }
    const result = await launchInstalledApp(match.id);
    if (!result.ok) return { ok: false, output: "", error: result.error ?? "Launch failed" };
    return { ok: true, output: `Launched ${match.name}${match.publisher ? ` (${match.publisher})` : ""}` };
  } catch (error) {
    return { ok: false, output: "", error: error instanceof Error ? error.message : "Launch failed" };
  }
}

async function runSearchApps(args: { query?: string }): Promise<ToolResult> {
  const query = args.query?.trim().toLowerCase();
  if (!query) return { ok: false, output: "", error: "No search term provided" };
  try {
    const installed = await getInstalledApps();
    const matched = installed
      .filter((candidate) => candidate.name.toLowerCase().includes(query) || (candidate.publisher ?? "").toLowerCase().includes(query))
      .slice(0, 20);
    if (matched.length === 0) return { ok: true, output: "No installed applications matched the search." };
    return {
      ok: true,
      output: matched.map((candidate) => `${candidate.name}${candidate.version ? ` ${candidate.version}` : ""}${candidate.publisher ? ` — ${candidate.publisher}` : ""}`).join("\n"),
    };
  } catch (error) {
    return { ok: false, output: "", error: error instanceof Error ? error.message : "Search failed" };
  }
}

async function runTopProcesses(args: { limit?: number }): Promise<ToolResult> {
  const raw = Number(args.limit);
  const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.round(raw), 1), 30) : 10;
  try {
    const processes = await getTopProcesses(limit);
    if (processes.length === 0) return { ok: true, output: "No process data available." };
    return {
      ok: true,
      output: processes.map((process) => `${process.name} — pid ${process.pid} — ${process.cpuPercent?.toFixed(1) ?? process.memoryMB ?? "?"}% CPU`).join("\n"),
    };
  } catch (error) {
    return { ok: false, output: "", error: error instanceof Error ? error.message : "Process listing failed" };
  }
}

const MAX_DOC_TOOL_CHARS = 12_000;

async function runReadDocument(args: { path?: string }): Promise<ToolResult> {
  const raw = args.path?.trim();
  if (!raw) return { ok: false, output: "", error: "No file path provided" };
  if (!path.isAbsolute(raw)) return { ok: false, output: "", error: "An absolute path is required" };
  try {
    let target: string;
    try {
      target = resolveSystemTarget(raw);
    } catch {
      target = resolveDeviceTarget(raw);
    }
    const { text, note } = await extractText(target);
    if (!text) return { ok: true, output: note || "No text content could be extracted from this file." };
    const preview = path.basename(target);
    const body = text.length > MAX_DOC_TOOL_CHARS ? `${text.slice(0, MAX_DOC_TOOL_CHARS)}… [truncated]` : text;
    return { ok: true, output: `── ${preview} ──\n${body}` };
  } catch (error) {
    return { ok: false, output: "", error: error instanceof Error ? error.message : "Could not read document" };
  }
}

const EXECUTORS: Record<string, (args: unknown) => Promise<ToolResult>> = {
  get_system_metrics: () => runMetrics(),
  list_workspace: (args) => runListWorkspace(args as { path?: string }),
  open_application: (args) => runOpenApp(args as { app?: string }),
  search_installed_apps: (args) => runSearchApps(args as { query?: string }),
  get_top_processes: (args) => runTopProcesses(args as { limit?: number }),
  read_document: (args) => runReadDocument(args as { path?: string }),
};

export function ollamaTools(): ToolSpec[] {
  return TOOL_SPECS;
}

export async function executeTool(name: string, args: unknown): Promise<ToolResult> {
  const executor = EXECUTORS[name];
  if (!executor) return { ok: false, output: "", error: `Unknown tool: ${name}` };
  try {
    return await executor(args);
  } catch (error) {
    return { ok: false, output: "", error: error instanceof Error ? error.message : "Tool failed" };
  }
}