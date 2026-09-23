import type { AgentId, AIAgent } from "@/types";

export const AGENTS: AIAgent[] = [
  {
    id: "orchestrator",
    name: "TECHY Orchestrator",
    tagline: "Routes every request to the right specialist agent.",
    color: "#22d3ee",
    capabilities: ["intent routing", "memory", "briefing", "agenda", "automation"],
  },
  {
    id: "research",
    name: "Research Agent",
    tagline: "Searches the knowledge base and answers from local documents.",
    color: "#8b5cf6",
    capabilities: ["knowledge search", "document digest", "summaries"],
  },
  {
    id: "file",
    name: "File Agent",
    tagline: "Finds, previews and prepares your files.",
    color: "#f59e0b",
    capabilities: ["file search", "content search", "meeting prep", "duplicates", "favorites"],
  },
  {
    id: "coding",
    name: "Coding Agent",
    tagline: "Inspects the codebase and works inside your IDE.",
    color: "#34d399",
    capabilities: ["source preview", "project context", "run tools"],
  },
  {
    id: "design",
    name: "Design Agent",
    tagline: "Opens design applications and file categories.",
    color: "#ec4899",
    capabilities: ["app categories", "design tool launcher", "assets"],
  },
  {
    id: "productivity",
    name: "Productivity Agent",
    tagline: "Keeps tasks, reminders and your day on track.",
    color: "#38bdf8",
    capabilities: ["tasks", "reminders", "calendar", "daily briefing"],
  },
  {
    id: "system",
    name: "System Agent",
    tagline: "Reports what the machine is actually doing.",
    color: "#22c55e",
    capabilities: ["CPU/RAM/GPU", "temps", "storage", "processes", "startup", "battery"],
  },
  {
    id: "communication",
    name: "Communication Agent",
    tagline: "Handles messages, notifications and meeting prep.",
    color: "#facc15",
    capabilities: ["notifications", "meetings", "reminders to people"],
  },
];

const DIRECTION_KEYWORDS: Array<{ agent: AgentId; words: Array<string | RegExp> }> = [
  {
    agent: "research",
    words: [
      "research", "knowledge base", "look up", "explain", "what does", "what is",
      "does (any|my) (document|file|note)", "search my notes", "summarize",
      "spreadsheet", "analyze this", "analyze", "sales", "data file",
    ],
  },
  {
    agent: "file",
    words: [
      "find .* file", "file", "pdf", "document", "folder", "preview", "open .* file",
      "prepare (the )?relevant documents", "duplicate", "logo", "image file",
    ],
  },
  {
    agent: "coding",
    words: [
      "code", "vscode", "visual studio", "compile", "debug", "project", "typescript",
      "npm", "next.js", "repository",
    ],
  },
  {
    agent: "design",
    words: [
      "design", "figma", "photoshop", "illustrator", "brand", "logo", "space", "pixel", "vector",
      "print", "artwork", "large-format", "banner", "poster", "standee",
    ],
  },
  {
    agent: "productivity",
    words: [
      "task", "remind", "todo", "reminder", "meeting", "schedule", "calendar", "briefing", "agenda",
      "good morning", "plan", "deadline",
    ],
  },
  {
    agent: "system",
    words: [
      "cpu", "ram", "memory usage", "gpu", "temperature", "temp", "storage", "disk", "battery",
      "process", "startup", "system summary", "most ram", "network",
    ],
  },
  {
    agent: "communication",
    words: ["notify", "notification", "message", "email", "alert"],
  },
];

/** Scores every specialist agent against the request and returns the best route. */
export function chooseAgent(input: string): {
  primary: AIAgent;
  matches: Array<{ agent: AIAgent; score: number }>;
} {
  const lower = input.toLowerCase();
  const matches: Array<{ agent: AIAgent; score: number }> = [];

  for (const rule of DIRECTION_KEYWORDS) {
    let score = 0;
    for (const word of rule.words) {
      if (typeof word === "string") {
        if (lower.includes(word)) score += 1;
      } else {
        const regex = new RegExp(word.source, word.flags.includes("g") ? word.flags : `${word.flags}g`);
        const hits = lower.match(regex);
        if (hits) score += hits.length;
      }
    }
    const agent = AGENTS.find((entry) => entry.id === rule.agent);
    if (agent && score > 0) matches.push({ agent, score });
  }

  matches.sort((a, b) => b.score - a.score);
  const primary = matches[0]?.agent ?? AGENTS[0];
  return { primary, matches };
}

const TOOL_AGENTS: Record<string, AgentId> = {
  get_system_metrics: "system",
  get_top_processes: "system",
  get_system_summary: "system",
  get_storage: "system",
  get_temps: "system",
  get_battery: "system",
  find_apps_by_category: "design",
  open_application: "design",
  search_installed_apps: "design",
  search_files: "file",
  list_directory: "file",
  read_document: "file",
  find_duplicates: "file",
  search_knowledge: "research",
  list_tasks: "productivity",
  create_task: "productivity",
  complete_task: "productivity",
  get_calendar: "productivity",
  create_event: "productivity",
  prepare_meeting: "file",
  run_automation: "orchestrator",
  get_briefing: "productivity",
};

export function agentForTool(tool: string): AIAgent {
  const id = TOOL_AGENTS[tool] ?? "orchestrator";
  return AGENTS.find((agent) => agent.id === id) ?? AGENTS[0];
}