import { promises as fs } from "node:fs";
import path from "node:path";
import type { Briefing, BriefingConfig, BriefingSectionName } from "@/types";
import { getEvents, isSameDay } from "@/lib/calendar";
import { getTasks } from "@/lib/tasks";
import { getCpuUsage, getRamInfo, getStorageInfo } from "@/lib/system/hardware";
import { WORKSPACE_ROOT } from "@/lib/system/files";

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "briefing.json");

const DEFAULT_CONFIG: BriefingConfig = {
  sections: {
    meetings: true,
    tasks: true,
    system: true,
    projects: true,
    files: true,
    recommendations: true,
  },
  greeting: "GOOD MORNING.",
};

let writeQueue: Promise<unknown> = Promise.resolve();

async function readConfig(): Promise<BriefingConfig> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed, sections: { ...DEFAULT_CONFIG.sections, ...(parsed.sections ?? {}) } };
  } catch {
    return { ...DEFAULT_CONFIG, sections: { ...DEFAULT_CONFIG.sections } };
  }
}

function queueWrite(updater: (config: BriefingConfig) => BriefingConfig): Promise<BriefingConfig> {
  const run = writeQueue.then(async () => {
    const next = updater(await readConfig());
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(CONFIG_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
  writeQueue = run.catch(() => {});
  return run;
}

export async function getBriefingConfig(): Promise<BriefingConfig> {
  return readConfig();
}

export async function updateBriefingConfig(patch: Partial<BriefingConfig>): Promise<BriefingConfig> {
  return queueWrite((config) => {
    if (typeof patch.greeting === "string") config.greeting = patch.greeting;
    if (patch.sections) config.sections = { ...config.sections, ...patch.sections };
    return config;
  });
}

function greetingForHour(hour: number): string {
  if (hour < 5) return "BURNING THE MIDNIGHT OIL.";
  if (hour < 12) return "GOOD MORNING.";
  if (hour < 17) return "GOOD AFTERNOON.";
  if (hour < 21) return "GOOD EVENING.";
  return "GOOD EVENING.";
}

const START_OF_DAY_SKIP = new Set(["node_modules", ".git", ".next", "public", "src", "data", "dist", "build"]);

async function activeProjects(now: Date): Promise<{ count: number; names: string[] }> {
  try {
    const cutoff = now.getTime() - 7 * 86_400_000;
    const entries = await fs.readdir(WORKSPACE_ROOT, { withFileTypes: true });
    const projects: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || START_OF_DAY_SKIP.has(entry.name)) continue;
      try {
        const stat = await fs.stat(path.join(WORKSPACE_ROOT, entry.name));
        if (stat.mtimeMs >= cutoff) projects.push(entry.name);
      } catch {
        // skip unreadable dirs
      }
    }
    return { count: projects.length, names: projects.slice(0, 6) };
  } catch {
    return { count: 0, names: [] };
  }
}

async function filesReceived(now: Date): Promise<{ count: number; items: string[] }> {
  const cutoff = now.getTime() - 24 * 3_600_000;
  const candidates = ["data/fixtures", "data/watch", "data/processed", "data/summaries"];
  const items: string[] = [];
  for (const relative of candidates) {
    const dir = path.join(WORKSPACE_ROOT, relative);
    try {
      const entries = await fs.readdir(dir);
      for (const name of entries) {
        const full = path.join(dir, name);
        try {
          const stat = await fs.stat(full);
          if (stat.isFile() && stat.mtimeMs >= cutoff) items.push(name);
        } catch {
          // skip
        }
      }
    } catch {
      // dir may not exist
    }
  }
  return { count: items.length, items: items.slice(0, 6) };
}

/** Builds the daily briefing, honouring the user's section toggles. */
export async function buildBriefing(): Promise<Briefing> {
  const config = await readConfig();
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const { sections } = config;
  const briefing: Briefing = {
    date: now,
    greeting: now.getHours() < 5 ? "BURNING THE MIDNIGHT OIL." : config.greeting || greetingForHour(now.getHours()),
    sections: {
      meetings: { count: 0, items: [] },
      tasks: { count: 0, items: [] },
      system: { cpu: 0, ram: 0, disk: 0, notes: [] },
      projects: { count: 0, names: [] },
      files: { count: 0, items: [] },
      recommendations: [],
    },
  };

  const [metrics, storage, ram, events, tasks] = await Promise.all([
    sections.system ? getCpuUsage() : Promise.resolve(0),
    sections.system ? getStorageInfo() : Promise.resolve(null),
    sections.system ? Promise.resolve(getRamInfo()) : Promise.resolve(null),
    sections.meetings ? getEvents({ from: dayStart, to: dayEnd }) : Promise.resolve([]),
    sections.tasks ? getTasks() : Promise.resolve([]),
  ]);

  if (sections.meetings) {
    const todayMeetings = events.filter((event) => isSameDay(event.start, now));
    briefing.sections.meetings = {
      count: todayMeetings.length,
      items: todayMeetings.map((event) => ({
        title: event.title,
        start: event.start.toISOString(),
        location: event.location,
        minutes: event.end ? Math.round((event.end.getTime() - event.start.getTime()) / 60_000) : 60,
      })),
    };
  }

  if (sections.tasks) {
    const open = tasks.filter((task) => task.status === "todo" || task.status === "in_progress");
    const dueSoon = open.filter(
      (task) =>
        (task.remindAt && task.remindAt.getTime() >= dayStart.getTime() - 86_400_000 && task.remindAt.getTime() <= dayEnd.getTime())
        || Boolean(task.dueTime)
    );
    const urgent = dueSoon.filter((task) => task.priority === "urgent" || (task.remindAt && task.remindAt.getTime() < now.getTime()));
    briefing.sections.tasks = {
      count: urgent.length > 0 ? urgent.length : dueSoon.length,
      items: dueSoon.slice(0, 8).map((task) => ({ title: task.title, urgent: task.priority === "urgent" })),
    };
  }

  if (sections.system && storage && ram) {
    const notes: string[] = [];
    if (metrics > 85) notes.push("CPU is elevated — consider closing heavy apps.");
    if (ram.percentage > 84) notes.push(`RAM at ${Math.round(ram.percentage)}% — a restart may help.`);
    if (storage.percentage > 88) notes.push(`Disk is ${Math.round(storage.percentage)}% full — free some space soon.`);
    briefing.sections.system = {
      cpu: metrics,
      ram: Math.round(ram.percentage),
      disk: Math.round(storage.percentage),
      notes,
    };
  }

  if (sections.projects) {
    briefing.sections.projects = await activeProjects(now);
  }

  if (sections.files) {
    briefing.sections.files = await filesReceived(now);
  }

  if (sections.recommendations) {
    const recommendations = briefing.sections.recommendations;
    const upcoming = events.find((event) => event.start.getTime() > now.getTime());
    if (upcoming && upcoming.start.getTime() - now.getTime() <= 2 * 3_600_000) {
      recommendations.push({
        icon: "📅",
        level: "warn",
        text: `“${upcoming.title}” starts ${formatClock(upcoming.start)} — have the documents ready?`,
      });
    }
    const urgentTasks = briefing.sections.tasks.items.filter((task) => task.urgent);
    if (urgentTasks.length > 0) {
      recommendations.push({ icon: "✅", level: "warn", text: `${urgentTasks.length} urgent task${urgentTasks.length === 1 ? "" : "s"} need attention today.` });
    } else if (briefing.sections.tasks.count > 0) {
      recommendations.push({ icon: "✅", level: "info", text: `${briefing.sections.tasks.count} task${briefing.sections.tasks.count === 1 ? "" : "s"} on the plate — knock the first one out early.` });
    }
    const prepped = events.filter((event) => event.preparedAt);
    if (prepped.length === 0 && briefing.sections.meetings.count > 0) {
      recommendations.push({ icon: "📁", level: "info", text: "Try: “prepare the relevant documents” for your next meeting." });
    }
    if (recommendations.length === 0) {
      recommendations.push({ icon: "🟢", level: "info", text: "System looks healthy — a good day to get things done." });
    }
  }

  return briefing;
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Renders the briefing as plain text for chat skills / automation notifications. */
export function formatBriefing(briefing: Briefing): string {
  const lines: string[] = [briefing.greeting, ""];
  const { sections } = briefing;

  if (sections.meetings.count > 0) {
    lines.push("TODAY");
    for (const meeting of sections.meetings.items) {
      lines.push(`  📅 ${formatClock(new Date(meeting.start))} — ${meeting.title}${meeting.location ? ` ` + meeting.location : ""}`);
    }
    if (sections.meetings.count === 0) lines.push("  No meetings scheduled.");
  }

  if (sections.tasks.count > 0) {
    lines.push("TASKS");
    for (const task of sections.tasks.items) lines.push(`  ${task.urgent ? "⚠️" : "•"} ${task.title}`);
  }

  lines.push(`SYSTEM  CPU ${sections.system.cpu}% · RAM ${sections.system.ram}% · DISK ${sections.system.disk}%`);
  for (const note of sections.system.notes) lines.push(`  · ${note}`);

  if (sections.projects.count > 0) {
    lines.push(`PROJECTS  ${sections.projects.count} active — ${sections.projects.names.join(", ")}`);
  }

  if (sections.files.count > 0) {
    lines.push(`FILES  ${sections.files.count} important document(s) received — ${sections.files.items.join(", ")}`);
  }

  if (sections.recommendations.length > 0) {
    lines.push("TECHY RECOMMENDS");
    for (const recommendation of sections.recommendations) lines.push(`  ${recommendation.icon} ${recommendation.text}`);
  }

  return lines.join("\n");
}

export type { BriefingSectionName };