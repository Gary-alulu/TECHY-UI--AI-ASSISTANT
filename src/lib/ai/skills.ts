import os from "node:os";
import { promises as fs } from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "@/lib/system/files";
import { getCpuUsage, getHardwareInfo, getNetworkInfo, getRamInfo, getStorageInfo, getTopProcesses, getTemperatureInfo, getGpuMemoryUsage } from "@/lib/system/hardware";
import { resolveCategoryKeyword, appsInCategory } from "@/lib/system/appCategories";
import { getInstalledApps, launchInstalledApp } from "@/lib/system/apps";
import { getTasks, addTask, updateTask } from "@/lib/tasks";
import { parseReminderPhrase } from "@/lib/schedule";
import { addFact, getMemory, clearFacts, setPreference } from "@/lib/memory";
import { searchKnowledgeForChat } from "@/lib/knowledge";
import { getEvents, addEvent, getEvent } from "@/lib/calendar";
import { prepareForEvent } from "@/lib/prep";
import { buildBriefing, formatBriefing } from "@/lib/briefing";
import { getAutomations, runAutomation } from "@/lib/automation";
import { getDeveloperSnapshot } from "@/lib/dev";
import type { AppCategory, AgentId, SafeModeCapability } from "@/types";

export interface SkillMatch {
  tool: string;
  detail: string;
  answer: string;
  agent?: AgentId;
}

function formatRate(mbPerSec: number): string {
  if (mbPerSec >= 1024) return `${(mbPerSec / 1024).toFixed(1)} GB/s`;
  return `${mbPerSec.toFixed(1)} MB/s`;
}

async function answerDevDiagnose(): Promise<SkillMatch> {
  const snapshot = await getDeveloperSnapshot();
  const lines: string[] = [];

  if (snapshot.logs.length > 0) {
    const log = snapshot.logs[0];
    const tail = log.lines.slice(-14).join("\n");
    lines.push(`Last ${log.file} output:`);
    lines.push("```\n" + tail + "\n```");
  }

  if (snapshot.ports.length > 0) {
    lines.push(`Port ${snapshot.ports[0].port} is in use by ${snapshot.ports[0].process} (pid ${snapshot.ports[0].pid}).`);
  }
  const startup = snapshot.logs.find((entry) => /error|failed|exception/i.test(entry.lines.join("\n")));
  if (startup) lines.push(`\nAn error is present in ${startup.file} — the last error block is above.`);
  lines.push(`\n${snapshot.nodeProcesses} node process(es) running · ${snapshot.branch} on ${snapshot.status} changed file(s).`);

  return {
    tool: "get_developer_snapshot",
    detail: "Developer diagnostics",
    answer: `Here's what I found about the app:\n${lines.join("\n")}`,
    agent: "coding",
  };
}

async function answerPrintArtwork(input: string): Promise<SkillMatch | null> {
  const { listWorkspaceImages, inspectImage } = await import("@/lib/imaging");
  const images = await listWorkspaceImages();
  if (images.length === 0) {
    return { tool: "inspect_image", detail: "Print check", answer: "No images found in the workspace to inspect. Toss a PNG/JPEG into the project and ask me again.", agent: "design" };
  }
  const tokens = input.replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((word) => word.length > 3 && !["print", "large", "format", "artwork", "prepare", "banner", "poster", "printing", "standee", "check", "inspect", "verify"].includes(word));
  const target = images.find((image) => {
    const base = image.name.toLowerCase();
    return tokens.some((token) => base.includes(token));
  }) ?? images[0];
  try {
    const inspection = await inspectImage(target.path);
    const lines = [
      `${inspection.name} (${inspection.format.toUpperCase()})`,
      `  ${inspection.width} × ${inspection.height}px · ${inspection.bitDepth ?? "?"}-bit ${inspection.colorMode ?? ""}`,
      `  ${(inspection.bytes / 1024).toFixed(1)} KB on disk`,
    ];
    if (inspection.palette.length > 0) lines.push(`  Palette: ${inspection.palette.map((color) => `${color.hex} ${color.share}%`).join(" · ")}`);
    if (inspection.printInfo) {
      lines.push(`  At 300 DPI this prints up to ${inspection.printInfo.maxWidthCm} × ${inspection.printInfo.maxHeightCm} cm.`);
      lines.push(inspection.printInfo.qualifies ? "  That qualifies for large-format output." : "  That is below the 40 cm large-format threshold — request a higher-resolution export.");
    } else {
      lines.push("  Print check: format not supported for sizing analysis.");
    }
    return { tool: "inspect_image", detail: "Print readiness", answer: `Print check — ${lines.join("\n")}`, agent: "design" };
  } catch (error) {
    return { tool: "inspect_image", detail: "Print check", answer: `Could not inspect ${target.name}: ${error instanceof Error ? error.message : "unknown error"}`, agent: "design" };
  }
}

async function answerMemory(): Promise<SkillMatch> {
  const processes = await getTopProcesses(6);
  const ram = getRamInfo();
  const lines = processes.map(
    (process, index) => `${index + 1}. ${process.name} — ${process.memoryMB} MB${process.cpuPercent != null ? `, ${process.cpuPercent.toFixed(1)}% CPU` : ""}`
  );
  return {
    tool: "get_top_processes",
    detail: "Memory usage by process",
    answer: `Here's what's using the most memory right now (${ram.usedGB.toFixed(1)} / ${ram.totalGB.toFixed(1)} GB overall):\n${lines.join("\n")}`,
  };
}

async function answerSystemSummary(): Promise<SkillMatch> {
  const [hardware, cpu, network, storage, temperatures, gpuMemory] = await Promise.all([
    getHardwareInfo(),
    getCpuUsage(),
    getNetworkInfo(),
    getStorageInfo().catch(() => ({ percentage: 0, usedGB: 0, totalGB: 0, mount: "" })),
    getTemperatureInfo(),
    getGpuMemoryUsage(),
  ]);
  const ram = getRamInfo();
  const parts: string[] = [
    `**CPU**: ${cpu.toFixed(1)}% · ${hardware.cpu.model} (${hardware.cpu.cores} cores / ${hardware.cpu.logical} threads)`,
    ...(temperatures.cpu != null ? [`**CPU temp**: ${temperatures.cpu.toFixed(1)}°C`] : []),
    `**RAM**: ${ram.usedGB.toFixed(1)} / ${ram.totalGB.toFixed(1)} GB (${ram.percentage.toFixed(1)}%)`,
    `**Disk**: ${storage.usedGB} / ${storage.totalGB} GB (${Math.round(storage.percentage)}% used)`,
    ...(hardware.gpu.present
      ? [`**GPU**: ${hardware.gpu.name}${temperatures.gpu != null ? ` · ${temperatures.gpu.toFixed(1)}°C` : ""}${gpuMemory ? ` · ${gpuMemory.usedMB}/${gpuMemory.totalMB} MB VRAM` : ""}`]
      : []),
    `**Network**: ↓ ${formatRate(network.totals.download)} · ↑ ${formatRate(network.totals.upload)}`,
  ];
  if (hardware.battery) {
    parts.push(`**Battery**: ${hardware.battery.percentage}%${hardware.battery.charging ? " (charging)" : ""}`);
  }
  parts.push(`**Uptime**: ${Math.floor(os.uptime() / 60)} min`);
  return { tool: "get_system_metrics", detail: "Full system snapshot", answer: parts.join("\n") };
}

async function answerTemperatures(): Promise<SkillMatch> {
  const { cpu, gpu } = await getTemperatureInfo();
  const lines: string[] = [];
  if (cpu != null) lines.push(`CPU: ${cpu.toFixed(1)}°C`);
  else lines.push("CPU temperature isn't exposed by this machine (needs admin or specific drivers).");
  if (gpu != null) lines.push(`GPU: ${gpu.toFixed(1)}°C`);
  else lines.push("GPU temperature isn't exposed (only reported via nvidia-smi).");
  return { tool: "get_system_metrics", detail: "Temperatures", answer: `Current temperatures:\n${lines.join("\n")}` };
}

async function answerBattery(): Promise<SkillMatch> {
  const hardware = await getHardwareInfo();
  const battery = hardware.battery;
  if (!battery) return { tool: "get_system_metrics", detail: "Battery", answer: "No battery detected — this machine is running on AC power." };
  return {
    tool: "get_system_metrics",
    detail: "Battery",
    answer: `Battery at ${battery.percentage}%, ${battery.charging ? "charging" : "on battery"}${battery.timeRemaining != null ? ` (est. ${Math.round(battery.timeRemaining / 60)} min left)` : ""}.`,
  };
}

async function answerOpenCategory(categoryId: AppCategory, categoryWord: string): Promise<SkillMatch> {
  const installed = await getInstalledApps();
  const candidates = appsInCategory(installed, categoryId).slice(0, 5);
  if (candidates.length === 0) {
    return {
      tool: "find_apps_by_category",
      detail: `${categoryWord} apps`,
      answer: `No launchable ${categoryWord} applications were found on this machine.`,
    };
  }
  const results = await Promise.all(candidates.map((candidate) => launchInstalledApp(candidate.id)));
  const launched = candidates.filter((_, index) => results[index].ok).map((candidate) => candidate.name);
  if (launched.length === 0) {
    return { tool: "open_application", detail: `${categoryWord} apps`, answer: `I couldn't launch any ${categoryWord} applications.` };
  }
  const failed = candidates.length - launched.length;
  return {
    tool: "open_application",
    detail: `${categoryWord} apps`,
    answer: `Launched ${launched.length} ${categoryWord} application${launched.length > 1 ? "s" : ""}: ${launched.join(", ")}${failed ? ` (${failed} failed)` : ""}.`,
  };
}

const OPEN_CATEGORY_RE =
  /(?:open|launch|open up|start|run|fire up)\s+(?:up\s+)?(?:my\s+)?(?:all\s+)?(.{0,28}?)\s*(?:apps?|applications|programs|tools)/i;

function formatClock(value: Date): string {
  return value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatReminderDate(value: Date): string {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(value, today)) return `today at ${formatClock(value)}`;
  if (sameDay(value, tomorrow)) return `tomorrow at ${formatClock(value)}`;
  return value.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Strips a matched "when" phrase from the original words and cleans leftover filler. */
function extractActionFromInput(rawInput: string, matchedText: string): string {
  let action = rawInput;
  if (matchedText) {
    const index = action.toLowerCase().indexOf(matchedText);
    if (index >= 0) action = `${action.slice(0, index)}${action.slice(index + matchedText.length)}`;
  }
  action = action
    .replace(/^(please\s+)?(remind me|reminder|set a reminder|set reminder|nudge me|alert me)\b[\s,:.]*/i, "")
    .replace(/^(that i should|to also|to)\b[\s,]*/i, "")
    .replace(/[\s,]+$/, "")
    .trim();
  return action.slice(0, 200);
}

async function answerKnowledge(rawInput: string): Promise<SkillMatch | null> {
  const input = rawInput.toLowerCase();
  let query: string | null = null;

  const direct = input.match(
    /\bdoes (?:any|my) (?:document|file|note|notes|documents|files|readme|readmes|report|reports|manual|manuals)\w*\s+(?:mention|contain|talk about|cover|refer to|say)\s+["']?([^"']{2,120})/
  );
  if (direct) query = direct[1];

  const searchPhrase = input.match(/\bsearch (?:my )?(?:notes|documents|files|knowledge(?: base)?|docs)\s+(?:for|about)\s+["']?([^"']{2,120})/);
  if (!query && searchPhrase) query = searchPhrase[1];

  const whatSay = input.match(/\bwhat (?:do|does) (?:my|the) (?:docs|documents|notes|files|reports)\s+(?:say|mention)\s+(?:about|regarding)\s+["']?([^"']{2,120})/);
  if (!query && whatSay) query = whatSay[1];

  const lookUp = input.match(/\b(?:look up|find me|tell me about)\s+["']?([^"']{2,120})["']? (?:from|in) (?:my |the )?(?:docs|documents|notes|files|knowledge base)/);
  if (!query && lookUp) query = lookUp[1];

  if (!query) return null;

  const answer = await searchKnowledgeForChat(query.trim(), 4);
  return { tool: "search_knowledge", detail: `Knowledge: “${query}”`, answer };
}

async function answerRemember(rawInput: string, input: string): Promise<SkillMatch | null> {
  // "remember to do X" ⇒ a plain task.
  if (/\bremember to\b/.test(input)) {
    const title = rawInput.replace(/\bplease\b/gi, "").replace(/^.*?\bremember to\b\s*/i, "").trim().slice(0, 200);
    if (!title) return null;
    const task = await addTask({ title, priority: "medium" });
    return { tool: "create_task", detail: "Todo", answer: `Got it — added “${task.title}” to your tasks.` };
  }

  // "remember that …" / "remember this: …" ⇒ a memory fact.
  const rememberThat = input.match(/\bremember (?:that|this:?)\s*(.+)/);
  if (rememberThat) {
    const content = rawInput.replace(/^.*?\bremember (?:that|this:?)\s*/i, "").trim().slice(0, 400);
    if (!content) return null;
    const { fact } = await addFact({ content, source: "chat" });
    return {
      tool: "push_memory",
      detail: "Memory",
      answer: fact ? `Remembered: “${content}”.` : `I already remember that.`,
    };
  }

  return null;
}

async function answerPreferences(rawInput: string, input: string): Promise<SkillMatch | null> {
  const name = input.match(/\bmy name is ([a-z0-9 ._-]{2,40})/);
  if (name) {
    await setPreference("name", name[1].trim());
    return { tool: "push_memory", detail: "Preference", answer: `Nice to meet you, ${name[1].trim()}. I'll remember that.` };
  }

  const prefer = input.match(/^i (prefer|like|love|hate|usually|always|never)\s+([\w .'-]{3,120})\s*[.!?]?$/);
  if (prefer) {
    const { fact } = await addFact({ content: prefer[0].replace(/\s+[.!?]+$/, "").replace(/^i /, "I "), kind: "preference", source: "chat" });
    return {
      tool: "push_memory",
      detail: "Preference",
      answer: fact ? `Noted — I'll remember that preference.` : `That preference is already remembered.`,
    };
  }

  return null;
}

/** Synonym map from natural-language capability words to Safe Mode capabilities. */
const CAPABILITY_SYNONYMS: Array<{ key: SafeModeCapability; pattern: RegExp }> = [
  { key: "chat", pattern: /\b(ai )?chat(ting)?|conversation(s)?\b/ },
  { key: "fileRead", pattern: /\bfile read(ing)?|read(ing)? files?|reading access|read access\b/ },
  { key: "systemMonitor", pattern: /\bsystem monitor(ing)?|system metrics|hardware monitor(ing)?|monitor(ing)? (tools|system|metrics)\b/ },
  { key: "fileModify", pattern: /\bfile modif(y|ication|ying)|writing files?|edit(ing)? files?|delet(ing|e) files?|renam(ing|e) files?|move(ing)? files?\b/ },
  { key: "appControl", pattern: /\bapp control|open(ing)? apps?|launch(ing)? apps?|start(ing)? apps?|control(ling)? apps?\b/ },
  { key: "terminal", pattern: /\b(terminal|shell|command prompt|powershell|running commands?|run commands?|scripts)\b/ },
  { key: "automation", pattern: /\b(automation|automations|workflows?)\b/ },
];

async function answerSettings(rawInput: string, input: string): Promise<SkillMatch | null> {
  const { getSafeMode, setSafeMode, setSafeCapability, SAFE_MODE_CAPABILITIES } = await import("@/lib/safemode");

  const togglingSafeMode = /\bsafe[- ]mode\b/.test(input) && /\b(enable|turn(?:s)? on|switch(?:es|ed)? on|activate\w*|engage|disable|turn(?:s)? off|switch(?:es|ed)? off|deactivate\w*|stop|exit|off)\b/.test(input);
  if (togglingSafeMode) {
    const on = /\b(enable|turn(?:s)? on|switch(?:es|ed)? on|activate\w*|engage)\b/.test(input);
    await setSafeMode(on);
    return {
      tool: "update_settings",
      detail: on ? "Safe Mode enabled" : "Safe Mode disabled",
      answer: on
        ? "SAFE MODE is now ON. Chat and system monitoring stay available; file changes, app control, terminal and automations are blocked until you turn it off."
        : "SAFE MODE is now OFF. Computer-control capabilities are restored to your configured settings.",
      agent: "system",
    };
  }

  const togglingCapability = /\b(enable|allow|permit|grant|turn on|switch on|disable|block|deny|revoke|turn off|switch off)\b/.test(input);
  if (togglingCapability) {
    const match = CAPABILITY_SYNONYMS.find((entry) => entry.pattern.test(input));
    if (match) {
      const allow = /\b(enable|allow|permit|grant|turn on|switch on)\b/.test(input);
      await setSafeCapability(match.key, allow);
      const meta = SAFE_MODE_CAPABILITIES.find((capability) => capability.key === match.key);
      const state = await getSafeMode();
      const allowed = SAFE_MODE_CAPABILITIES.filter((capability) => capability.key === "chat" || capability.key === "systemMonitor" || state.capabilities[capability.key]).map((capability) => capability.label);
      return {
        tool: "update_settings",
        detail: `${meta?.label ?? match.key} ${allow ? "enabled" : "blocked"}`,
        answer: `${meta?.label ?? match.key} is now ${allow ? "allowed" : "blocked"}${state.active ? " in SAFE MODE" : ""}. Currently on: ${allowed.join(", ")}.`,
        agent: "system",
      };
    }
  }

  if (/\bsafe[- ]mode\b/.test(input) && /\b(on|active|enabled|status|state|is\b)\b/.test(input) || /\b(show|list|what are|which are).*\b(capabilities|allowed|blocked)\b/.test(input)) {
    const state = await getSafeMode();
    const allowed = SAFE_MODE_CAPABILITIES.filter((capability) => capability.key === "chat" || capability.key === "systemMonitor" || state.capabilities[capability.key]).map((capability) => capability.label);
    const blocked = SAFE_MODE_CAPABILITIES.filter((capability) => state.active && state.capabilities[capability.key] === false).map((capability) => capability.label);
    return {
      tool: "update_settings",
      detail: "Settings status",
      answer: `SAFE MODE is ${state.active ? "ON" : "OFF"}.${state.active ? ` Currently allowed: ${allowed.join(", ")}${blocked.length ? `. Blocked: ${blocked.join(", ")}` : ""}.` : ""} You can switch it with “enable safe mode” / “disable safe mode”.`,
      agent: "system",
    };
  }

  return null;
}

async function answerRecall(): Promise<SkillMatch> {
  const store = await getMemory();
  const parts: string[] = [];
  const preferences = Object.entries(store.preferences);
  if (preferences.length > 0) {
    parts.push(`**Preferences**: ${preferences.map(([key, value]) => `${key} = ${value}`).join("; ")}`);
  }
  if (store.facts.length > 0) {
    parts.push(`**Facts**: ${store.facts.map((fact) => fact.content).join(" · ")}`);
  }
  if (parts.length === 0) {
    return { tool: "fetch_memory", detail: "Memory", answer: "I don't remember anything about you yet. Tell me — “remember that I work in design”." };
  }
  return { tool: "fetch_memory", detail: "Memory", answer: `Here's what I remember about you:\n${parts.join("\n")}` };
}

async function answerForget(): Promise<SkillMatch> {
  await clearFacts();
  return { tool: "clear_memory", detail: "Memory", answer: "Cleared the facts I was remembering." };
}

async function answerReminder(rawInput: string, input: string): Promise<SkillMatch | null> {
  const schedule = parseReminderPhrase(input);
  if (!schedule) return null;
  const title = extractActionFromInput(rawInput, schedule.matchedText);
  if (!title) return null;

  const task = await addTask({
    title,
    remindAt: schedule.remindAt,
    repeat: schedule.repeat,
    priority: "medium",
  });

  const repeatLabel =
    schedule.repeat === "daily" ? "daily" : schedule.repeat === "weekly" ? "weekly" : schedule.repeat === "monthly" ? "monthly" : "once";
  return {
    tool: "create_task",
    detail: schedule.repeat ? `${schedule.repeat} reminder` : "one-time reminder",
    answer: `Reminder set: “${task.title}” — ${formatReminderDate(schedule.remindAt)} (${repeatLabel}).`,
  };
}

async function answerTaskList(): Promise<SkillMatch> {
  const tasks = await getTasks();
  const active = tasks.filter((task) => task.status === "todo" || task.status === "in_progress");
  const completed = tasks.filter((task) => task.status === "completed").length;

  if (tasks.length === 0) {
    return { tool: "list_tasks", detail: "Task list", answer: "You have no tasks yet. Try “remind me tomorrow at 9 to call Sam”." };
  }

  const rows = active
    .slice(0, 8)
    .map((task, index) => {
      const when = task.remindAt ? `${formatReminderDate(task.remindAt)}${task.repeat ? " (repeats)" : ""}` : task.dueTime ?? "no due time";
      return `${index + 1}. ${task.title} — ${when} [${task.priority}]`;
    });
  const header = `${active.length} open task${active.length === 1 ? "" : "s"} (${completed} completed):`;
  return {
    tool: "list_tasks",
    detail: "Task list",
    answer: rows.length > 0 ? `${header}\n${rows.join("\n")}` : `${header}\nGreat — nothing open.`,
  };
}

async function answerCompleteTask(input: string): Promise<SkillMatch | null> {
  const matching = input.match(/\b(?:mark|set|complete|finish)\s+(.+?)\s+(?:as\s+)?(?:done|complete)\b|^done with\s+(.+)/);
  if (!matching) return null;
  const rawNeedle = (matching[1] ?? matching[2] ?? "").toLowerCase().trim();
  const needle = rawNeedle.replace(/^(the|task|my)\s+/i, "").trim();
  if (!needle) return null;

  const tasks = await getTasks();
  const target =
    tasks.find((task) => task.title.toLowerCase().includes(needle) && task.status !== "completed") ??
    tasks.find((task) => task.title.toLowerCase().includes(needle));
  if (!target) {
    return { tool: "complete_task", detail: "Complete task", answer: `I couldn't find an open task matching “${rawNeedle}”.` };
  }
  await updateTask(target.id, { status: "completed" });
  return {
    tool: "complete_task",
    detail: `Completed “${target.title}”`,
    answer: `Done — “${target.title}” is marked complete.`,
  };
}

function formatEventTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

async function answerBriefing(): Promise<SkillMatch> {
  const briefing = await buildBriefing();
  return { tool: "get_briefing", detail: "Daily briefing", answer: formatBriefing(briefing), agent: "productivity" };
}

async function answerAgenda(_rawInput: string, input: string): Promise<SkillMatch | null> {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  let from: Date;
  let to: Date;
  let windowLabel: string;

  if (/\btomorrow\b/.test(input)) {
    from = new Date(dayEnd);
    to = new Date(dayEnd.getTime() + 86_400_000);
    windowLabel = "tomorrow";
  } else if (/\b(this|coming|next) week\b|\bweek (ahead|coming)\b/.test(input)) {
    from = now;
    to = new Date(now.getTime() + 7 * 86_400_000);
    windowLabel = "the next 7 days";
  } else {
    const nextHours = input.match(/\bnext (\d+) hours?\b/);
    if (nextHours) {
      from = now;
      to = new Date(now.getTime() + Number(nextHours[1]) * 3_600_000);
      windowLabel = `the next ${nextHours[1]} hours`;
    } else {
      from = dayStart;
      to = dayEnd;
      windowLabel = /today/.test(input) ? "today" : "today";
    }
  }

  const [events, tasks] = await Promise.all([getEvents({ from, to }), getTasks()]);
  if (events.length === 0 && tasks.length === 0) {
    return { tool: "get_calendar", detail: `Agenda for ${windowLabel}`, answer: `Nothing scheduled for ${windowLabel}.`, agent: "productivity" };
  }

  const lines: string[] = [];
  lines.push(`Your agenda for ${windowLabel}:`);

  for (const event of events) {
    const prep = event.preparedAt ? " ✓ prepared" : "";
    lines.push(`  📅 ${formatEventTime(event.start)} — ${event.title}${event.location ? ` (${event.location})` : ""}${prep}`);
  }

  const activeTasks = tasks.filter((task) => {
    if (task.status === "completed" || task.status === "cancelled") return false;
    return task.remindAt && task.remindAt.getTime() >= from.getTime() - 60_000 && task.remindAt.getTime() <= to.getTime();
  });
  for (const task of activeTasks.slice(0, 8)) {
    lines.push(`  ☐ ${formatEventTime(task.remindAt!)} — ${task.title}`);
  }

  if (events.length === 0) lines.push("  No meetings — just reminders.");
  if (activeTasks.length === 0) lines.push("  No reminders due in this window.");

  return { tool: "get_calendar", detail: `Agenda for ${windowLabel}`, answer: lines.join("\n"), agent: "productivity" };
}

async function answerCreateEvent(rawInput: string, input: string): Promise<SkillMatch | null> {
  const schedule = parseReminderPhrase(input);
  const wantPrepare = /\bprepare\b/.test(input);
  if (!schedule) return null;

  const base = rawInput
    .replace(/^please,\s*/i, "")
    .replace(/^.*?\b(i have|schedule|book|plan|add)\b\s*(a|an|the)?\s*/i, "")
    .replace(/["']/g, "");
  const title = base
    .replace(new RegExp(schedule.matchedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "")
    .replace(/\bprepare (the )?relevant documents\b/gi, "")
    .replace(/^[,.\s]+|[,.\s]+$/g, "")
    .trim();
  if (!title) return null;

  let start = schedule.remindAt;
  const bare = input.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/);
  if (bare && !/\b(am|pm)\b/.test(input) && Number(bare[1]) < 8) {
    start = new Date(start);
    start.setHours(Number(bare[1]) + 12, Number(bare[2] ?? 0), 0, 0);
    if (start.getTime() <= Date.now()) start.setDate(start.getDate() + 1);
  }
  const end = new Date(start.getTime() + 60 * 60_000);
  const event = await addEvent({
    title,
    start,
    end,
    color: "#22d3ee",
  });

  let answer = `Scheduled: “${title}” at ${formatEventTime(start)}${start.getTime() > Date.now() ? "" : "."}`;
  answer += wantPrepare ? " Now preparing the relevant documents…" : "";

  if (wantPrepare) {
    const created = await getEvent(event.id);
    const { summary } = await prepareForEvent(created ?? event);
    answer += `\n${summary}`;
  }

  return { tool: "create_event", detail: `Meeting: ${title}`, answer, agent: "productivity" };
}

async function answerPrepMeeting(_rawInput: string, input: string): Promise<SkillMatch | null> {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const todayEvents = await getEvents({ from: dayStart, to: dayEnd });

  let target = todayEvents[0];
  const clock = input.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (clock) {
    let hour = Number(clock[1]) % 24;
    const minute = Number(clock[2] ?? 0) % 60;
    if (clock[3] === "pm" && hour < 12) hour += 12;
    if (clock[3] === "am" && hour === 12) hour = 0;
    target = todayEvents.find((event) => event.start.getHours() === hour && Math.abs(event.start.getMinutes() - minute) <= 30) ?? target;
  }

  if (!target) {
    return {
      tool: "prepare_meeting",
      detail: "Meeting preparation",
      answer: "No event found to prepare for — try “schedule a meeting at 2” first.",
      agent: "file",
    };
  }

  const { summary } = await prepareForEvent(target);
  return { tool: "prepare_meeting", detail: `Prepared for “${target.title}”`, answer: summary, agent: "file" };
}

async function answerAutomation(_rawInput: string, input: string): Promise<SkillMatch | null> {
  const automations = await getAutomations();
  if (automations.length === 0) {
    return {
      tool: "run_automation",
      detail: "Automation engine",
      answer: "No workflows yet. The Automation Engine can watch a folder for new PDFs, summarize, rename, move and notify — create one on the Automation page.",
      agent: "orchestrator",
    };
  }

  const named = input.match(/\b(?:run|execute|fire)\s+(?:the\s+)?([a-z0-9 ._-]{2,60})\s*(?:workflow|automation)?\b/);
  let target = named ? automations.find((automation) => automation.name.toLowerCase().includes(named[1].trim())) : undefined;
  if (!target) target = automations.find((automation) => automation.enabled);

  if (!target) {
    return {
      tool: "run_automation",
      detail: "Automation engine",
      answer: `Workflows available: ${automations.map((automation) => automation.name).join(", ")}. Say “run the ${automations[0].name.toLowerCase()} workflow”.`,
      agent: "orchestrator",
    };
  }

  const run = await runAutomation(target.id);
  const headline = run.status === "completed" ? `Ran “${target.name}”` : `“${target.name}” failed`;
  const summary = run.actions
    .map((action) => `  ${action.status === "completed" ? "✓" : "✗"} ${action.name} — ${action.detail}`)
    .join("\n");
  return { tool: "run_automation", detail: `Ran “${target.name}”`, answer: `${headline}:\n${summary}`, agent: "orchestrator" };
}

async function walkWorkspace(maxDepth: number): Promise<Array<{ name: string; full: string }>> {
  const found: Array<{ name: string; full: string }> = [];
  const rec = async (dir: string, depth: number): Promise<void> => {
    if (depth > maxDepth) return;
    let entries: Array<{ isDirectory(): boolean; isFile(): boolean; name: string }> = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".next") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await rec(full, depth + 1);
      else if (entry.isFile()) {
        found.push({ name: entry.name, full });
        if (found.length >= 400) return;
      }
    }
  };
  await rec(WORKSPACE_ROOT, 0);
  return found;
}

const FILE_STOP = new Set(["find", "locate", "search", "where", "my", "the", "old", "any", "file", "files", "for", "is", "a", "an", "have", "please", "show", "me", "that", "this"]);

async function answerFindFile(input: string): Promise<SkillMatch | null> {
  const tokens = input.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 1 && !FILE_STOP.has(word));
  const everything = await walkWorkspace(4);
  const matches = everything.filter((entry) => tokens.some((token) => entry.name.toLowerCase().includes(token)));
  if (matches.length === 0) return null;
  const shown = matches.slice(0, 6).map((entry) => `  • ${entry.full.replace(WORKSPACE_ROOT, ".")}`).join("\n");
  return {
    tool: "search_files",
    detail: `${matches.length} file${matches.length === 1 ? "" : "s"} matched "${tokens.join(" ")}"`,
    answer: `Found ${matches.length} matching file${matches.length === 1 ? "" : "s"}:\n${shown}`,
    agent: "file",
  };
}

async function answerAnalyzeData(input: string): Promise<SkillMatch | null> {
  const tokens = input.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 2 && !FILE_STOP.has(word) && !["analyze", "analysis", "sales", "spreadsheet", "data", "numbers", "report", "this", "that"].includes(word));
  const everything = await walkWorkspace(4);
  const matches = everything.filter((entry) => /\.(csv|xlsx?|json)$/i.test(entry.name) && (tokens.length === 0 || tokens.some((token) => `${entry.name} ${entry.full}`.toLowerCase().includes(token))));
  if (matches.length === 0) return null;
  const shown = matches.slice(0, 8).map((entry) => `  • ${entry.name} — ${entry.full.replace(WORKSPACE_ROOT, ".")}`).join("\n");
  return {
    tool: "search_files",
    detail: `Found ${matches.length} data files`,
    answer: `I located ${matches.length} data file${matches.length === 1 ? "" : "s"} to analyze:\n${shown}\n\nConnect a local model and I can read through them, or hand one over and I'll summarize it.`,
    agent: "research",
  };
}

export async function runSkillIfMatched(rawInput: string): Promise<SkillMatch | null> {
  const input = rawInput.trim().toLowerCase();
  if (!input) return null;

  if (/\b(forget|erase|clear)(?: (everything|all|your memory|that))?\b|\bclear your memory\b/.test(input) && /memory|remember/.test(input)) {
    const forgotten = await answerForget();
    if (forgotten) return forgotten;
  }

  if (
    /\b(what do you know about me|what do you remember|what are my preferences|my preferences|what's in your memory|what have i told you|do you remember (me|anything|my))\b/.test(input) ||
    /\bdo you remember (?!that\b)/i.test(input)
  ) {
    const recalled = await answerRecall();
    if (recalled) return recalled;
  }

  if (/\bremember (that|this:?|to)\b/.test(input)) {
    const remembered = await answerRemember(rawInput, input);
    if (remembered) return remembered;
  }

  if (/^i (prefer|like|love|hate|usually|always|never)\s+[\w .'-]{3,120}/.test(input) || /\bmy name is [a-z0-9 ._-]{2,40}/.test(input)) {
    const preference = await answerPreferences(rawInput, input);
    if (preference) return preference;
  }

  const settings = await answerSettings(rawInput, input);
  if (settings) return settings;

  if (
    /\b(does .*(document|file|note|documents|files|readme|report|manual)\w* (mention|contain|talk about|cover|refer to|say)|search .*(notes|documents|files|knowledge|docs) (for|about)|what (do|does) (my|the) (docs|documents|notes|files|reports) (say|mention)|look up .* from (my |the )?(docs|documents|notes|files|knowledge base))\b/.test(input)
  ) {
    const knowledge = await answerKnowledge(rawInput);
    if (knowledge) return knowledge;
  }

  if (/\b(briefing|daily briefing|morning briefing|morning report)\b/.test(input) || /^(good )?morning\b/.test(input) || /\bwhat'?s (up|new)\b[\s!?]*$/.test(input)) {
    return answerBriefing();
  }

  const devComplaint = /\bwhy\b[\s\S]{0,90}\b(start\w*|build\w*|launch\w*|run\w*|boot\w*|work\w*|startup|load\w*|restart\w*|serve\w*)\b/;
  if (devComplaint.test(input) && /\b(app|server|next|dev|site|front-?end|page|build|npm|local|port)\b/.test(input)) {
    return answerDevDiagnose();
  }
  if (/\b(debug|diagnos|troubleshoot)\b/.test(input) && /\b(start|build|launch|log|port|error|crash)\b/.test(input)) {
    return answerDevDiagnose();
  }

  if (/\b(prepare|check|verify|inspect)( (the|this|that))?.*\b(artwork|print|banner|poster|large-format|large format|standee|roll-?up|flyer|billboard)\b/.test(input) || /\blarge-format printing\b/.test(input)) {
    const printed = await answerPrintArtwork(input);
    if (printed) return printed;
  }

  if (/\b(where('| i)?s|find|locate|search for)\b.*\b(logo|image|picture|photo|attachment|document)\b/.test(input)) {
    const located = await answerFindFile(input);
    if (located) return located;
  }

  if (/\banalyze\b[\s\S]{0,60}\b(sales|spreadsheet|numbers|data|budget|finance|report)\b|\b(read|analyze).*\bspreadsheet\b/.test(input)) {
    const analyzed = await answerAnalyzeData(input);
    if (analyzed) return analyzed;
  }

  if (/\b(run|execute|fire|trigger)\s+(the\s+)?([a-z0-9 ._-]{2,60})\s*(workflow|automation)\b|\brun\s+(all\s+)?(workflows|automations)\b/.test(input)) {
    const automation = await answerAutomation(rawInput, input);
    if (automation) return automation;
  }

  const scheduleGrammar = /\b(what'?s (on|in) (my|the)? ?(schedule|calendar|agenda)|(my|today'?s|tomorrow'?s) (schedule|calendar|agenda)|what do i (have|need)|what('| i)?s (on )?(today|this week))\b/;
  if (scheduleGrammar.test(input) && /schedule|calendar|agenda|have|today|tomorrow|week|next \d+ hours/.test(input)) {
    const agenda = await answerAgenda(rawInput, input);
    if (agenda) return agenda;
  }

  const createGrammar = /\b(i have|schedule|book|add|plan)\b.*\b(meeting|call|appointment|session|demo|review|interview|stand-?up|event|catch-?up)\b/;
  if (createGrammar.test(input)) {
    const created = await answerCreateEvent(rawInput, input);
    if (created) return created;
  }

  if (/\bprepare\b/.test(input) || /\b(what should i (review|read|look at|prepare) for|get (the )?documents ready)\b/.test(input)) {
    const prepared = await answerPrepMeeting(rawInput, input);
    if (prepared) return prepared;
  }

  if (/\b(remind me|set a reminder|set reminder|reminder|nudge me|alert me)\b/.test(input)) {
    const reminder = await answerReminder(rawInput, input);
    if (reminder) return reminder;
  }

  const completion = await answerCompleteTask(input);
  if (completion) return completion;

  if (
    /\b(list|show|what('| i)?s)?\s*(my\s+)?(tasks|to-?do|to-?do list|reminders)\b/.test(input) ||
    /\b(show|list|check) my (tasks|reminders|to-?dos\b)/.test(input)
  ) {
    return answerTaskList();
  }

  const openCategory = input.match(OPEN_CATEGORY_RE);
  if (openCategory) {
    const categoryId = resolveCategoryKeyword(openCategory[1].trim() || openCategory[0]);
    if (categoryId) {
      const categoryWord = openCategory[1].trim() || categoryId;
      return answerOpenCategory(categoryId, categoryWord);
    }
  }

  if (/battery\b|battery level|battery life|how.*charged/.test(input)) return answerBattery();
  if (/temperat|how hot|overheat|thermal|too (hot|warm)/.test(input)) return answerTemperatures();
  if (
    /most (ram|memory)|using the most (ram|memory)|memory (hungry|heavy|usage|consumption)|high ram|ram (usage|use)/.test(input) ||
    /what('| i)?s? using (all )?(my|the)?( ram| memory)/.test(input) ||
    /who('| i)?s? eating( my)? ram/.test(input)
  ) {
    return answerMemory();
  }
  if (
    /system (status|summary|health)|how(-? )?(is|does|'s) (the|my)?\s*(system|machine)|machine (status|health)|what('| i)?s? the (system|machine) (status|situation)|give me a (system )?summary/.test(input) ||
    /overall (health|status)/.test(input)
  ) {
    return answerSystemSummary();
  }

  return null;
}