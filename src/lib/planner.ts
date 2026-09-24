import { promises as fs } from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "@/lib/system/files";
import { searchFiles, type SearchResult } from "@/lib/system/search";
import { TEXT_EXTENSIONS } from "@/lib/system/documents";
import { searchKnowledgeForChat } from "@/lib/knowledge";
import { buildBriefing } from "@/lib/briefing";
import { getEvents } from "@/lib/calendar";
import { addTask } from "@/lib/tasks";

export type PlanAction =
  | "understand"
  | "find_files"
  | "read_documents"
  | "knowledge"
  | "briefing"
  | "calendar"
  | "tasks"
  | "output";

export type PlanStepStatus = "pending" | "running" | "done" | "failed";

export interface PlanStep {
  id: string;
  action: PlanAction;
  title: string;
  detail: string;
  params: Record<string, string>;
  status: PlanStepStatus;
  result?: string;
}

export interface PlanIntent {
  client?: string;
  date?: string;
  focus?: string;
  keywords: string[];
}

export interface TaskPlan {
  goal: string;
  slug: string;
  created: string;
  intent: PlanIntent;
  steps: PlanStep[];
}

const DAYS = /(next week|this week|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i;

const FOCUS_KEYWORDS: Array<{ words: string[]; label: string }> = [
  { words: ["proposal", "quote", "estimate"], label: "proposal" },
  { words: ["briefing", "brief", "summary"], label: "briefing" },
  { words: ["presentation", "slides", "deck"], label: "presentation" },
  { words: ["design", "artwork", "print"], label: "design" },
  { words: ["report", "analysis"], label: "report" },
  { words: ["checklist", "agenda"], label: "checklist" },
  { words: ["questions", "prepare questions"], label: "questions" },
  { words: ["files", "documents", "folder"], label: "files" },
];

const GENERIC_CAPITALS = new Set([
  "Prepare", "Meeting", "Tomorrow", "Today", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  "Sunday", "Week", "Next", "This", "TECHY", "Task", "Plan", "Client", "Make", "Get", "Design", "Review",
]);

function slugify(goal: string): string {
  return goal.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "plan";
}

function parseIntent(goal: string): PlanIntent {
  const low = goal.toLowerCase();
  const date = DAYS.exec(low)?.[1].toLowerCase();
  const clientMatch = goal.match(/\b(?:for|with)\s+([A-Z][A-Za-z]{2,})(?:\s+[A-Z][A-Za-z' -]+)?\b/);
  const capitalized = goal.match(/\b([A-Z][a-z]{2,})\b/g) ?? [];
  const client = (
    (clientMatch ? [clientMatch[1], ...clientMatch[0].split(/\s+/).slice(2).filter((w) => /^[A-Z]/.test(w))] : capitalized)
      .find((word) => word.length >= 3 && !GENERIC_CAPITALS.has(word))
  );
  const focus = FOCUS_KEYWORDS.find(({ words }) => words.some((word) => low.includes(word)))?.label;
  const keywords = FOCUS_KEYWORDS.flatMap(({ words, label }) => (words.some((word) => low.includes(word)) ? [label] : []));
  if (client) keywords.push(client.toLowerCase());
  return { client, date, focus, keywords: [...new Set(keywords)].slice(0, 4) };
}

export function planForGoal(goal: string): TaskPlan {
  const trimmed = goal.trim();
  const intent = parseIntent(trimmed);
  const slug = slugify(trimmed);
  const created = new Date().toISOString();
  const query = intent.client ?? intent.focus ?? intent.keywords[0] ?? (trimmed.replace(/\b(prepare|for|the|a)\b/gi, "").trim().slice(0, 40) || trimmed);

  const steps: PlanStep[] = [
    {
      id: "understand",
      action: "understand",
      title: "Understand the request",
      detail: `Parse the goal into client, date and focus.`,
      params: {},
      status: "pending",
    },
    {
      id: "find_files",
      action: "find_files",
      title: `Search project files`,
      detail: intent.client || intent.focus ? `Search the workspace for "${query}"` : "Search the workspace for anything matching the goal",
      params: { query },
      status: "pending",
    },
    {
      id: "read_documents",
      action: "read_documents",
      title: "Review the top matches",
      detail: "Read the best-matching files to ground the plan",
      params: {},
      status: "pending",
    },
    {
      id: "knowledge",
      action: "knowledge",
      title: "Check memory & knowledge base",
      detail: 'Look for past facts, preferences and indexed knowledge about "' + query + '"',
      params: { query },
      status: "pending",
    },
    {
      id: "briefing",
      action: "briefing",
      title: "Pull the morning briefing",
      detail: "System state, today's meetings, tasks and project names",
      params: {},
      status: "pending",
    },
    {
      id: "calendar",
      action: "calendar",
      title: "Scan the upcoming schedule",
      detail: "Everything in the next 7 days",
      params: {},
      status: "pending",
    },
    {
      id: "tasks",
      action: "tasks",
      title: "Create a reminder",
      detail: intent.date === "tomorrow" ? "Tomorrow 09:00 — time to prepare" : "Set as a pending preparation task",
      params: {},
      status: "pending",
    },
    {
      id: "output",
      action: "output",
      title: "Prepare the output",
      detail: "Assemble everything into a Markdown report",
      params: {},
      status: "pending",
    },
  ];

  return { goal: trimmed, slug, created, intent, steps };
}

export async function buildPlanReport(plan: TaskPlan): Promise<string> {
  const lines: string[] = [
    `# TECHY PLAN — ${plan.goal}`,
    "",
    `_Created ${plan.created}${plan.intent.client ? ` · client: ${plan.intent.client}` : ""}${plan.intent.date ? ` · when: ${plan.intent.date}` : ""}${plan.intent.focus ? ` · focus: ${plan.intent.focus}` : ""}_`,
    "",
  ];
  for (const step of plan.steps) {
    lines.push(`## ${step.title}`, "", step.result || step.detail, "");
  }
  return lines.join("\n").trim() + "\n";
}

// ── Executors ─────────────────────────────────────────

interface ExecContext {
  foundPaths: string[];
}

function cap(text: string, max: number): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}…`;
}

async function runStep(plan: TaskPlan, step: PlanStep, context: ExecContext): Promise<string> {
  switch (step.action) {
    case "understand": {
      const intent = plan.intent;
      const chips = [
        intent.client ? `client=${intent.client}` : "",
        intent.date ? `when=${intent.date}` : "",
        intent.focus ? `focus=${intent.focus}` : "",
      ].filter(Boolean);
      return `Goal: ${plan.goal}\nIntent: ${chips.length > 0 ? chips.join(", ") : "general task"}\nQuery for search: "${step.params.query ?? "auto"}"`;
    }
    case "find_files": {
      const query = step.params.query ?? "";
      const { results } = await searchFiles({ query, scope: "system" });
      const files = results.filter((result: SearchResult) => result.type === "file");
      context.foundPaths = files.slice(0, 6).map((file) => file.path);
      if (files.length === 0) return `No workspace files matched "${query}".`;
      return files
        .slice(0, 6)
        .map((file) => `- ${file.name} (${path.relative(WORKSPACE_ROOT, file.path)})`)
        .join("\n");
    }
    case "read_documents": {
      const targets = context.foundPaths.filter((target) => TEXT_EXTENSIONS.test(target)).slice(0, 3);
      if (targets.length === 0) return "No readable documents matched — nothing to review.";
      const previews: string[] = [];
      for (const target of targets) {
        try {
          const text = (await fs.readFile(target, "utf8")).replace(/\s+/g, " ").trim();
          previews.push(`**${path.basename(target)}**: ${cap(text, 900)}`);
        } catch {
          previews.push(`**${path.basename(target)}**: (unreadable)`);
        }
      }
      return cap(previews.join("\n\n"), 3500);
    }
    case "knowledge": {
      const contextText = await searchKnowledgeForChat(step.params.query ?? plan.goal, 5);
      return cap(contextText, 2400);
    }
    case "briefing": {
      try {
        const briefing = await buildBriefing();
        const parts: string[] = [];
        if (briefing.sections.meetings.count > 0) {
          parts.push(`Meetings today: ${briefing.sections.meetings.count} — ${briefing.sections.meetings.items.map((item) => item.title).slice(0, 5).join(", ")}`);
        }
        if (briefing.sections.tasks.count > 0) {
          parts.push(`Tasks needing attention: ${briefing.sections.tasks.count}`);
        }
        if (briefing.sections.projects.names.length > 0) {
          parts.push(`Projects: ${briefing.sections.projects.names.slice(0, 6).join(", ")}`);
        }
        parts.push(`System: CPU ${briefing.sections.system.cpu}% · RAM ${briefing.sections.system.ram}% · disk ${briefing.sections.system.disk}%`);
        return parts.join("\n");
      } catch {
        return "Briefing unavailable right now (metric service busy).";
      }
    }
    case "calendar": {
      const from = new Date();
      const to = new Date(from.getTime() + 7 * 86_400_000);
      try {
        const events = await getEvents({ from, to });
        if (events.length === 0) return "No events in the next 7 days.";
        const formatter = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        return events
          .slice(0, 6)
          .map((event) => `- ${formatter.format(event.start)} — ${event.title}`)
          .join("\n");
      } catch {
        return "Calendar store could not be read.";
      }
    }
    case "tasks": {
      try {
        const remindTime = new Date();
        remindTime.setDate(remindTime.getDate() + 1);
        remindTime.setHours(9, 0, 0, 0);
        const task = await addTask({
          title: `Prepare for: ${plan.goal}`,
          description: `Autogenerated preparation task from a TECHY plan.${plan.intent.client ? ` Client: ${plan.intent.client}.` : ""}`,
          remindAt: remindTime,
          priority: "high",
          tags: ["plan"],
        });
        return `Reminder created — "${task.title}" · ${new Date(task.remindAt ?? "").toLocaleString() || "date pending"}`;
      } catch {
        return "Could not create the reminder.";
      }
    }
    case "output": {
      const dir = path.join(process.cwd(), "data", "plans");
      await fs.mkdir(dir, { recursive: true });
      const markdown = await buildPlanReport(plan);
      const file = path.join(dir, `${plan.slug}.md`);
      await fs.writeFile(file, markdown, "utf8");
      return `Report saved → data/plans/${plan.slug}.md (${markdown.length} chars)`;
    }
  }
}

export type PlanProgress = (event: { step: PlanStep; index: number }) => void;

export async function executePlan(plan: TaskPlan, onProgress?: PlanProgress): Promise<void> {
  const context: ExecContext = { foundPaths: [] };
  for (let index = 0; index < plan.steps.length; index += 1) {
    const step = plan.steps[index];
    step.status = "running";
    onProgress?.({ step, index });
    try {
      step.result = await runStep(plan, step, context);
      step.status = "done";
    } catch (error) {
      step.status = "failed";
      step.result = error instanceof Error ? error.message : "Step failed";
    }
    onProgress?.({ step, index });
  }
}