import os from "node:os";
import path from "node:path";
import { getCpuUsage, getHardwareInfo, getNetworkInfo, getRamInfo, getStorageInfo, getTopProcesses, getTemperatureInfo, getGpuMemoryUsage } from "@/lib/system/hardware";
import { getInstalledApps, launchInstalledApp } from "@/lib/system/apps";
import { listDirectory, resolveDeviceTarget, resolveSystemTarget } from "@/lib/system/files";
import { extractText } from "@/lib/system/documents";
import { resolveCategoryKeyword, appsInCategory } from "@/lib/system/appCategories";
import { getTasks, addTask, updateTask } from "@/lib/tasks";
import { searchKnowledgeForChat } from "@/lib/knowledge";
import { getEvents, addEvent, getEvent } from "@/lib/calendar";
import { prepareForEvent } from "@/lib/prep";
import { buildBriefing, formatBriefing } from "@/lib/briefing";
import { getAutomations, runAutomation } from "@/lib/automation";
import { getDeveloperSnapshot } from "@/lib/dev";
import { inspectImage } from "@/lib/imaging";
import type { SafeModeCapability } from "@/types";

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
      description: "Return live machine metrics: CPU usage and model, CPU/GPU temperature, RAM used/total, storage used/total, GPU VRAM used, network upload/download rate, battery (if present) and uptime.",
      parameters: { type: "object", properties: {} },
    },
  },
{
    type: "function",
    function: {
      name: "read_document",
      description: "Extract the text content of a local file (PDF, DOCX, XLSX, TXT, CSV, JSON, Markdown). Returns abbreviated content for large documents.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Absolute path of the file to read" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "Return the user's tasks with their status, priority and scheduled reminder time.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a task on behalf of the user. Provide remindAt as an ISO-8601 timestamp when the user asked to be reminded or scheduled. repeat can be daily, weekly or monthly.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short task title" },
          description: { type: "string" },
          dueTime: { type: "string" },
          remindAt: { type: "string", description: "ISO-8601 reminder moment, e.g. 2026-09-23T09:00:00.000Z" },
          repeat: { type: "string", enum: ["none", "daily", "weekly", "monthly"] },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_task",
      description: "Mark an existing task as completed by id or by matching its title.",
      parameters: {
        type: "object",
        properties: { task_id: { type: "string", description: "Task id from list_tasks" }, title: { type: "string", description: "Task title (fuzzy match)" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_knowledge",
      description: "Search the local knowledge base (indexed workspace documents: notes, readmes, reports, CSVs, PDFs, DOCX) for a topic and return ranked snippets with sources.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Topic to find within the local documents" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_calendar",
      description: "List calendar events. Use from/to as ISO timestamps, or leave empty for the next 7 days from now.",
      parameters: {
        type: "object",
        properties: { from: { type: "string", description: "ISO start of window" }, to: { type: "string", description: "ISO end of window" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_event",
      description: "Add a calendar event with an ISO start time and an optional end time, location, notes and color.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Event title" },
          start: { type: "string", description: "ISO start time" },
          end: { type: "string", description: "ISO end time" },
          location: { type: "string", description: "Location" },
        },
        required: ["title", "start"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_meeting",
      description: "Prepare the relevant documents for a calendar event: previous proposal, client folder, notes and images. Provide the event id (from get_calendar) if known.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "Calendar event id" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_automation",
      description: "Run a saved automation workflow by id, or by matching its name. Returns a summary of the actions it performed.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "Workflow id" }, name: { type: "string", description: "Workflow name (fuzzy)" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_briefing",
      description: "Build the daily briefing: today's meetings, tasks, system status, active projects, documents received and TECHY's recommendations.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_developer_snapshot",
      description: "Developer diagnostics for the workspace project: git branch/status/recent commits, package scripts, listening local servers with owning process, recent server logs and the count of running node processes. Use when debugging why the Next.js app won't start or what is running.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "inspect_image",
      description: "Inspect a local image (PNG/JPEG): dimensions, bit depth, color mode, dominant color palette and a print-readiness check (max print size at 300 DPI). Use to prepare artwork for printing.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Absolute path of the image file" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_application",
      description:
        "Launch an installed application on this machine by name, e.g. \"Photoshop\", \"Chrome\", \"VLC\". A category word like \"design applications\" or \"my design apps\" opens every installed launchable app in that category (design, development, browser, media, office, communication, games, utilities, system).",
      parameters: {
        type: "object",
        properties: { app: { type: "string", description: "Application name or category of applications to open" } },
        required: ["app"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_apps_by_category",
      description:
        "List installed applications that belong to a category such as design, development, browser, media, office, communication, games, utilities, or system. Returns launchable apps, newest first.",
      parameters: {
        type: "object",
        properties: { category: { type: "string", description: "Category word, e.g. \"design\"" } },
        required: ["category"],
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
      description: "Return the running processes using the most memory, with PID, name, memory in MB, and CPU share.",
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
    const [hardware, cpu, network, storage, temperatures, gpuMemory] = await Promise.all([
      getHardwareInfo(),
      getCpuUsage(),
      getNetworkInfo(),
      getStorageInfo().catch(() => ({ percentage: 0, usedGB: 0, totalGB: 0, mount: "" })),
      getTemperatureInfo(),
      getGpuMemoryUsage(),
    ]);
    const ram = getRamInfo();
    const lines = [
      `${hardware.machine.manufacturer} ${hardware.machine.model} (${hardware.machine.osName})`,
      `CPU: ${cpu.toFixed(1)}% — ${hardware.cpu.model} (${hardware.cpu.cores} cores / ${hardware.cpu.logical} threads)`,
      ...(temperatures.cpu != null ? [`CPU temperature: ${temperatures.cpu.toFixed(1)}°C`] : ["CPU temperature: not exposed"]),
      `RAM: ${ram.usedGB.toFixed(1)} / ${ram.totalGB.toFixed(1)} GB (${ram.percentage.toFixed(1)}%)`,
      `Disk: ${storage.usedGB} / ${storage.totalGB} GB usable (${Math.round(storage.percentage)}% used)`,
      ...(hardware.gpu.present
        ? [
            `GPU: ${hardware.gpu.name}${temperatures.gpu != null ? ` — ${temperatures.gpu.toFixed(1)}°C` : ""}`,
            ...(gpuMemory ? [`GPU VRAM: ${gpuMemory.usedMB} / ${gpuMemory.totalMB} MB used`] : []),
          ]
        : ["GPU: none detected"]),
      `Network: ↓ ${network.totals.download} ${network.totals.unit} · ↑ ${network.totals.upload} ${network.totals.unit}`,
      ...(hardware.battery ? [`Battery: ${hardware.battery.percentage}%${hardware.battery.charging ? " (charging)" : ""}`] : []),
      `Uptime: ${Math.floor(os.uptime() / 60)} min`,
    ];
    return { ok: true, output: lines.join("\n") };
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
  const raw = args.app?.trim();
  if (!raw) return { ok: false, output: "", error: "No app name provided" };

  try {
    const installed = await getInstalledApps();

    const category = resolveCategoryKeyword(raw);
    if (category) {
      const candidates = appsInCategory(installed, category).slice(0, 5);
      if (candidates.length === 0) {
        return { ok: false, output: "", error: `No launchable ${category} applications were found.` };
      }
      const results = await Promise.all(candidates.map((candidate) => launchInstalledApp(candidate.id)));
      const launched = candidates.filter((_, index) => results[index].ok).map((candidate) => candidate.name);
      const failed = candidates.length - launched.length;
      if (launched.length === 0) {
        return { ok: false, output: "", error: `Could not launch any ${category} applications.` };
      }
      return {
        ok: true,
        output: `Launched ${launched.length} ${category} application${launched.length > 1 ? "s" : ""}: ${launched.join(", ")}${failed ? ` (${failed} failed)` : ""}`,
      };
    }

    const needle = raw.toLowerCase();
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

async function runFindAppsByCategory(args: { category?: string }): Promise<ToolResult> {
  const raw = args.category?.trim();
  if (!raw) return { ok: false, output: "", error: "No category provided" };
  try {
    const installed = await getInstalledApps();
    const category = resolveCategoryKeyword(raw);
    if (!category) {
      return { ok: false, output: "", error: "Unknown category. Try: design, development, browser, media, office, communication, games, utilities, system." };
    }
    const matched = appsInCategory(installed, category);
    if (matched.length === 0) return { ok: true, output: `No launchable ${category} applications found.` };
    return {
      ok: true,
      output: `${category.toUpperCase()} APPLICATIONS (${matched.length})\n${matched
        .map((candidate) => `${candidate.name}${candidate.publisher ? ` — ${candidate.publisher}` : ""}`)
        .join("\n")}`,
    };
  } catch (error) {
    return { ok: false, output: "", error: error instanceof Error ? error.message : "Search failed" };
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
    const label = `${"NAME".padEnd(24)} ${"PID".padStart(6)} ${"MB".padStart(8)} ${"CPU%".padStart(6)}`;
    const rows = processes.map((process) =>
      `${process.name.padEnd(24).slice(0, 24)} ${String(process.pid).padStart(6)} ${String(process.memoryMB).padStart(8)} ${String(process.cpuPercent ?? "—").padStart(6)}`
    );
    return { ok: true, output: `${label}\n${rows.join("\n")}` };
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

async function runSearchKnowledge(args: { query?: string }): Promise<ToolResult> {
  const query = args.query?.trim();
  if (!query) return { ok: false, output: "", error: "A search query is required" };
  try {
    const output = await searchKnowledgeForChat(query, 5);
    return { ok: true, output };
  } catch (error) {
    return { ok: false, output: "", error: error instanceof Error ? error.message : "Knowledge search failed" };
  }
}

async function runListTasks(): Promise<ToolResult> {
  try {
    const tasks = await getTasks();
    if (tasks.length === 0) return { ok: true, output: "No tasks." };
    const lines = tasks
      .sort((a, b) => (b.status === "completed" ? 1 : 0) - (a.status === "completed" ? 1 : 0))
      .slice(0, 20)
      .map((task) => {
        const when = task.remindAt
          ? task.remindAt.toISOString()
          : task.dueTime
            ? task.dueTime
            : "no schedule";
        return `${task.status} | ${task.priority.padEnd(6)} | ${when} | ${task.id} | ${task.title}`;
      });
    return { ok: true, output: `TASKS (${tasks.length})\n${lines.join("\n")}` };
  } catch (error) {
    return { ok: false, output: "", error: error instanceof Error ? error.message : "Task listing failed" };
  }
}

async function runCreateTask(args: {
  title?: string;
  description?: string;
  dueTime?: string;
  remindAt?: string;
  repeat?: string;
  priority?: string;
  tags?: string[];
}): Promise<ToolResult> {
  const title = args.title?.trim();
  if (!title) return { ok: false, output: "", error: "Task title is required" };
  try {
    const task = await addTask({
      title,
      description: args.description,
      dueTime: args.dueTime,
      remindAt: args.remindAt,
      repeat: args.repeat as Parameters<typeof addTask>[0]["repeat"],
      priority: args.priority,
      tags: args.tags,
    });
    const when = task.remindAt ? task.remindAt.toISOString() : task.dueTime ?? "no schedule";
    return { ok: true, output: `Created task ${task.id}: ${task.title} (${task.priority}, ${when})` };
  } catch (error) {
    return { ok: false, output: "", error: error instanceof Error ? error.message : "Task creation failed" };
  }
}

async function runCompleteTask(args: { task_id?: string; title?: string }): Promise<ToolResult> {
  const taskId = args.task_id?.trim();
  const title = args.title?.trim().toLowerCase();
  if (!taskId && !title) return { ok: false, output: "", error: "Provide task_id or title" };
  try {
    const tasks = await getTasks();
    const target = taskId
      ? tasks.find((task) => task.id === taskId)
      : title
        ? tasks.find((task) => task.title.toLowerCase() === title) ?? tasks.find((task) => task.title.toLowerCase().includes(title))
        : undefined;
    if (!target) return { ok: false, output: "", error: "Task not found" };
    const updated = await updateTask(target.id, { status: "completed" });
    if (!updated) return { ok: false, output: "", error: "Task not found" };
    return { ok: true, output: `Completed task: ${target.title}` };
  } catch (error) {
    return { ok: false, output: "", error: error instanceof Error ? error.message : "Task update failed" };
  }
}

async function runGetCalendar(args: { from?: string; to?: string }): Promise<ToolResult> {
  try {
    const now = new Date();
    const defaultTo = new Date(now.getTime() + 7 * 86_400_000);
    const from = args.from ? new Date(args.from) : now;
    const to = args.to ? new Date(args.to) : defaultTo;
    const events = await getEvents({ from, to });
    if (events.length === 0) return { ok: true, output: "No calendar events in this window." };
    const lines = events.map(
      (event) =>
        `${event.start.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })} — ${event.title}${event.location ? ` (${event.location})` : ""}${event.preparedAt ? " [prepared]" : ""}`
    );
    return { ok: true, output: `Calendar (${events.length} events):\n${lines.join("\n")}` };
  } catch (error) {
    return { ok: false, output: "", error: error instanceof Error ? error.message : "Calendar lookup failed" };
  }
}

async function runCreateEvent(args: { title?: string; start?: string; end?: string; location?: string }): Promise<ToolResult> {
  const title = args.title?.trim();
  const start = args.start ? new Date(args.start) : new Date();
  if (!title) return { ok: false, output: "", error: "Title is required" };
  try {
    const event = await addEvent({ title, start, end: args.end ? new Date(args.end) : undefined, location: args.location });
    return { ok: true, output: `Created calendar event: ${event.title} at ${event.start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} (${event.id})` };
  } catch (error) {
    return { ok: false, output: "", error: error instanceof Error ? error.message : "Event creation failed" };
  }
}

async function runPrepareMeeting(args: { id?: string }): Promise<ToolResult> {
  if (!args.id) return { ok: false, output: "", error: "Provide the calendar event id" };
  try {
    const event = await getEvent(args.id);
    if (!event) return { ok: false, output: "", error: `No calendar event with id ${args.id}` };
    const { summary, findings } = await prepareForEvent(event);
    return { ok: true, output: `${summary}\n(findings: ${findings.length})` };
  } catch (error) {
    return { ok: false, output: "", error: error instanceof Error ? error.message : "Preparation failed" };
  }
}

async function runAutomationTool(args: { id?: string; name?: string }): Promise<ToolResult> {
  const automations = await getAutomations();
  let target = args.id ? automations.find((automation) => automation.id === args.id) : undefined;
  if (!target && args.name) {
    target = automations.find((automation) => automation.name.toLowerCase().includes(args.name!.toLowerCase()));
  }
  if (!target && automations.length === 1) target = automations[0];
  if (!target) return { ok: false, output: "", error: "No matching workflow. Create one first." };
  try {
    const run = await runAutomation(target.id);
    const actions = run.actions.map((action) => `  ${action.status === "completed" ? "✓" : "✗"} ${action.name} — ${action.detail}`).join("\n");
    return { ok: true, output: `${target.name} · ${run.status}\n${actions}` };
  } catch (error) {
    return { ok: false, output: "", error: error instanceof Error ? error.message : "Workflow run failed" };
  }
}

async function runGetBriefing(): Promise<ToolResult> {
  try {
    const briefing = await buildBriefing();
    return { ok: true, output: formatBriefing(briefing) };
  } catch (error) {
    return { ok: false, output: "", error: error instanceof Error ? error.message : "Briefing failed" };
  }
}

const EXECUTORS: Record<string, (args: unknown) => Promise<ToolResult>> = {
  get_system_metrics: () => runMetrics(),
  list_workspace: (args) => runListWorkspace(args as { path?: string }),
  open_application: (args) => runOpenApp(args as { app?: string }),
  find_apps_by_category: (args) => runFindAppsByCategory(args as { category?: string }),
  search_installed_apps: (args) => runSearchApps(args as { query?: string }),
  get_top_processes: (args) => runTopProcesses(args as { limit?: number }),
  read_document: (args) => runReadDocument(args as { path?: string }),
  list_tasks: () => runListTasks(),
  create_task: (args) => runCreateTask(args as Parameters<typeof runCreateTask>[0]),
  complete_task: (args) => runCompleteTask(args as { task_id?: string; title?: string }),
  search_knowledge: (args) => runSearchKnowledge(args as { query?: string }),
  get_calendar: (args) => runGetCalendar(args as { from?: string; to?: string }),
  create_event: (args) => runCreateEvent(args as { title?: string; start?: string; end?: string; location?: string }),
  prepare_meeting: (args) => runPrepareMeeting(args as { id?: string }),
  run_automation: (args) => runAutomationTool(args as { id?: string; name?: string }),
  get_briefing: () => runGetBriefing(),
  get_developer_snapshot: () => runDeveloperSnapshot(),
  inspect_image: (args) => runInspectImage(args as { path?: string }),
};

export function ollamaTools(): ToolSpec[] {
  return TOOL_SPECS;
}

export const ACTIVITY_KIND: Record<string, "app" | "file" | "system" | "search" | "task" | "calendar" | "knowledge" | "developer" | "creative" | "automation" | "chat"> = {
  get_system_metrics: "system",
  get_top_processes: "system",
  get_storage: "system",
  get_temps: "system",
  get_battery: "system",
  get_system_summary: "system",
  get_developer_snapshot: "developer",
  open_application: "app",
  find_apps_by_category: "app",
  search_installed_apps: "app",
  list_workspace: "file",
  read_document: "file",
  list_directory: "file",
  search_files: "file",
  find_duplicates: "file",
  inspect_image: "creative",
  search_knowledge: "knowledge",
  fetch_memory: "knowledge",
  push_memory: "knowledge",
  clear_memory: "knowledge",
  get_briefing: "system",
  run_automation: "automation",
  list_tasks: "task",
  create_task: "task",
  complete_task: "task",
  get_calendar: "calendar",
  create_event: "calendar",
  prepare_meeting: "calendar",
};

/** Which Safe Mode capability gates each computer-control tool (unlisted tools are never blocked). */
const TOOL_CAPABILITY: Record<string, SafeModeCapability> = {
  get_system_metrics: "systemMonitor",
  get_top_processes: "systemMonitor",
  read_document: "fileRead",
  search_knowledge: "fileRead",
  inspect_image: "fileRead",
  find_apps_by_category: "appControl",
  search_installed_apps: "appControl",
  open_application: "appControl",
  run_automation: "automation",
  get_developer_snapshot: "terminal",
};

/** True when Safe Mode is active and blocks the capability this tool belongs to. */
export async function isToolBlocked(name: string): Promise<boolean> {
  const capability = TOOL_CAPABILITY[name];
  if (!capability) return false;
  const { safeModeBlocks } = await import("@/lib/safemode");
  return safeModeBlocks(capability);
}

export function toolCapability(name: string): SafeModeCapability | null {
  return TOOL_CAPABILITY[name] ?? null;
}

export async function executeTool(name: string, args: unknown): Promise<ToolResult> {
  if (await isToolBlocked(name)) {
    try {
      const { logActivity } = await import("@/lib/activity");
      await logActivity({ actor: "user", kind: "security", action: `Blocked: ${name}`, detail: "Safe Mode" });
    } catch {
      // activity is best-effort
    }
    return { ok: false, output: "", error: `Blocked by SAFE MODE (${toolCapability(name)}). Enable it under Safe Mode to allow this.` };
  }
  const executor = EXECUTORS[name];
  if (!executor) return { ok: false, output: "", error: `Unknown tool: ${name}` };
  try {
    const result = await executor(args);
    const { logActivity } = await import("@/lib/activity");
    const kind = ACTIVITY_KIND[name] ?? "chat";
    const detailArg = (args as { path?: string; app?: string; query?: string; name?: string; title?: string }) ?? {};
    const subject = detailArg.path ?? detailArg.app ?? detailArg.query ?? detailArg.name ?? detailArg.title ?? "";
    await logActivity({ actor: "techy", kind, action: `Tool: ${name}`, detail: subject || (result.ok ? "completed" : "failed") });
    return result;
  } catch (error) {
    return { ok: false, output: "", error: error instanceof Error ? error.message : "Tool failed" };
  }
}

async function runDeveloperSnapshot(): Promise<ToolResult> {
  try {
    const snapshot = await getDeveloperSnapshot();
    const lines = [
      `Repo: ${snapshot.branch}`,
      `Working changes: ${snapshot.status}`,
      ...snapshot.statusLines.slice(0, 6),
      `Commits:`,
      ...snapshot.recentCommits,
      `Package: ${snapshot.packageName}`,
      `Scripts: ${snapshot.scripts.map((script) => script.name).join(", ")}`,
      `Listening ports (${snapshot.ports.length}):`,
      ...snapshot.ports.slice(0, 8).map((port) => `  ${port.port} ${port.process} (pid ${port.pid})`),
      `Node processes running: ${snapshot.nodeProcesses}`,
      `Logs: ${snapshot.logs.map((entry) => `${entry.file} (${entry.lines.length} lines)`).join(", ")}`,
      ...snapshot.logs.slice(0, 1).map((entry) => entry.lines.slice(-6).join("\n")),
    ];
    return { ok: true, output: lines.join("\n") };
  } catch (error) {
    return { ok: false, output: "", error: error instanceof Error ? error.message : "Developer snapshot failed" };
  }
}

async function runInspectImage(args: { path?: string }): Promise<ToolResult> {
  if (!args.path) return { ok: false, output: "", error: "An image path is required" };
  try {
    const inspection = await inspectImage(args.path);
    const lines = [
      `${inspection.name} (${inspection.format.toUpperCase()})`,
      `  ${inspection.width} × ${inspection.height}px`,
      `  Bit depth: ${inspection.bitDepth ?? "—"} · Mode: ${inspection.colorMode ?? "—"}`,
      `  Size on disk: ${(inspection.bytes / 1024).toFixed(1)} KB`,
    ];
    if (inspection.palette.length > 0) lines.push(`  Palette: ${inspection.palette.map((color) => `${color.hex} (${color.share}%)`).join(", ")}`);
    if (inspection.printInfo) {
      lines.push(`  Print check (300 DPI): up to ${inspection.printInfo.maxWidthCm} × ${inspection.printInfo.maxHeightCm} cm — ${inspection.printInfo.qualifies ? "qualifies for large format" : "below large-format threshold"}`);
    }
    return { ok: true, output: lines.join("\n") };
  } catch (error) {
    return { ok: false, output: "", error: error instanceof Error ? error.message : "Image inspection failed" };
  }
}