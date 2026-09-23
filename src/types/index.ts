// ─────────────────────────────────────────────────────
// TECHY — Core Type System
// ─────────────────────────────────────────────────────

// ── AI States ──────────────────────────────────────────
export type AIState =
  | "idle"
  | "listening"
  | "thinking"
  | "executing"
  | "speaking"
  | "error";

export interface AIStateInfo {
  state: AIState;
  label: string;
  detail?: string;
  model?: string;
  toolName?: string;
}

// ── System Metrics ─────────────────────────────────────
export interface SystemMetrics {
  cpu: MetricValue & Partial<CpuInfo>;
  ram: MetricValue;
  gpu: MetricValue & Partial<Omit<GpuInfo, "devices">>;
  storage: StorageMetric & { mount?: string };
  network: NetworkMetric;
  battery?: BatteryMetric;
  temperatures?: TemperatureInfo;
  uptime?: number;
  machine?: MachineInfo;
  source?: "live" | "simulated";
}

// ── Hardware ───────────────────────────────────────────
export type GpuType = "dedicated" | "integrated" | "virtual" | "unknown" | "none";

export interface GpuDevice {
  name: string;
  vendor: string;
  type: GpuType;
  vramMB?: number;
  driverVersion?: string;
}

export interface GpuInfo {
  present: boolean;
  type: GpuType;
  hasDedicated: boolean;
  hasIntegrated: boolean;
  name: string;
  vendor: string;
  vramMB?: number;
  vramUsedMB?: number;
  devices: GpuDevice[];
}

export interface CpuInfo {
  model: string;
  cores: number;
  logical: number;
  speedMHz: number;
}

export interface MachineInfo {
  hostname: string;
  platform: string;
  osName: string;
  arch: string;
  manufacturer?: string;
  model?: string;
  systemType?: string;
  hasBattery: boolean;
  isLaptop: boolean;
}

/** Raw live snapshot returned by GET /api/system/metrics. */
export interface SystemSnapshot {
  cpu: { percentage: number } & CpuInfo;
  ram: { percentage: number; usedGB: number; totalGB: number };
  storage: { percentage: number; usedGB: number; totalGB: number; mount: string };
  gpu: GpuInfo & { percentage: number | null };
  temperatures?: TemperatureInfo;
  network: NetworkMetric;
  interfaces: NetworkInterfaceInfo[];
  machine: MachineInfo;
  battery: BatteryMetric | null;
  uptime: number;
  source: "live";
}

export interface TemperatureInfo {
  cpu: number | null;
  gpu: number | null;
}

/** A program configured to start automatically when the machine boots. */
export interface StartupApp {
  name: string;
  command?: string;
  location?: string;
  user?: string;
}

export interface NetworkInterfaceInfo {
  name: string;
  rxBytes: number;
  txBytes: number;
  rxRateMBps: number;
  txRateMBps: number;
}

/** A currently running process on the local machine. */
export interface ProcessInfo {
  pid: number;
  name: string;
  memoryMB: number;
  cpuSeconds?: number;
  cpuPercent?: number;
  responding?: boolean;
  path?: string;
}

export interface MetricValue {
  percentage: number;
  used?: number;
  total?: number;
  unit?: string;
  history: number[];
}

export interface StorageMetric {
  percentage: number;
  used: number;
  total: number;
  unit: string;
}

export interface NetworkMetric {
  upload: number;
  download: number;
  unit: string;
}

export interface BatteryMetric {
  percentage: number;
  charging: boolean;
  timeRemaining?: number;
}

// ── Messages & Chat ────────────────────────────────────
export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  toolExecution?: ToolExecution;
  toolExecutions?: ToolExecution[];
  attachments?: FileAttachment[];
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  model?: string;
}

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  path?: string;
}

// ── Tools ──────────────────────────────────────────────
export interface ToolExecution {
  id: string;
  toolName: string;
  status: "pending" | "running" | "completed" | "failed";
  input?: Record<string, unknown>;
  output?: string;
  detail?: string;
  error?: string;
  duration?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  permissionLevel: PermissionLevel;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

export type ToolCategory =
  | "filesystem"
  | "system"
  | "applications"
  | "terminal"
  | "ai"
  | "automation";

// ── Permissions ────────────────────────────────────────
export type PermissionLevel = "safe" | "confirmation_required" | "blocked";

export interface PermissionRequest {
  id: string;
  action: string;
  toolName: string;
  level: PermissionLevel;
  description: string;
  details?: string;
  timestamp: Date;
  status: "pending" | "approved" | "denied";
}

// ── Tasks ──────────────────────────────────────────────
export type TaskRepeat = "none" | "daily" | "weekly" | "monthly";

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: Date;
  dueTime?: string;
  /** Next scheduled reminder moment (ISO-backed, serialized as Date). */
  remindAt?: Date;
  /** How often the reminder repeats after it fires. */
  repeat?: TaskRepeat;
  priority: "low" | "medium" | "high" | "urgent";
  status: "todo" | "in_progress" | "completed" | "cancelled";
  createdAt: Date;
  completedAt?: Date;
  tags?: string[];
}

// ── Files ──────────────────────────────────────────────
export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  extension?: string;
  size?: number;
  modifiedAt?: Date;
  createdAt?: Date;
  children?: FileEntry[];
}

// ── Applications ───────────────────────────────────────
export interface Application {
  id: string;
  name: string;
  icon?: string;
  path?: string;
  category?: string;
  isRunning: boolean;
  pid?: number;
}

/** A real installed application discovered on this machine. */
export interface InstalledApp {
  id: string;
  name: string;
  version?: string;
  publisher?: string;
  estimatedSizeMB?: number;
  installDate?: string;
  installLocation?: string;
  exePath?: string;
  category?: AppCategory;
}

export type AppCategory =
  | "design"
  | "development"
  | "browser"
  | "communication"
  | "office"
  | "media"
  | "games"
  | "utilities"
  | "system"
  | "other";

// ── AI Provider ────────────────────────────────────────
export interface AIProvider {
  name: string;
  type: "ollama" | "lmstudio" | "llamacpp" | "openai_compatible" | "cloud";
  baseUrl: string;
  isConnected: boolean;
  models: AIModel[];
  chat: (messages: Message[], model?: string) => Promise<Message>;
  stream: (
    messages: Message[],
    model?: string,
    onChunk?: (chunk: string) => void
  ) => Promise<Message>;
  getModels: () => Promise<AIModel[]>;
}

export interface AIModel {
  id: string;
  name: string;
  type: "chat" | "embedding" | "vision" | "code";
  status: "active" | "inactive" | "loading" | "error";
  size?: string;
  ramUsage?: string;
  contextLength?: number;
  provider: string;
}

// ── Weather ────────────────────────────────────────────
export interface WeatherData {
  temperature: number;
  condition: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  location: string;
  forecast: WeatherForecast[];
}

export interface WeatherForecast {
  day: string;
  high: number;
  low: number;
  condition: string;
  icon: string;
}

// ── Navigation ─────────────────────────────────────────
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string | number;
}

// ── Calendar ───────────────────────────────────────────
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end?: Date;
  location?: string;
  attendees?: string[];
  notes?: string;
  color?: string;
  /** Set when TECHY has prepared the relevant documents for this event. */
  preparedAt?: Date;
  createdAt: Date;
}

// ── Notifications ──────────────────────────────────────
export type NotificationKind =
  | "new_file"
  | "meeting"
  | "task_overdue"
  | "download"
  | "ai_task"
  | "storage"
  | "crash"
  | "automation"
  | "briefing";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  source?: string;
  createdAt: Date;
  read: boolean;
}

// ── Automation Engine ──────────────────────────────────
export type AutomationTrigger =
  | { type: "manual" }
  | { type: "file_watch"; folder: string; pattern: string }
  | { type: "schedule"; dayOfWeek: number; hour: number; minute: number };

export type AutomationActionName =
  | "read_text"
  | "summarize"
  | "rename"
  | "move"
  | "notify"
  | "create_task"
  | "briefing";

export interface AutomationAction {
  name: AutomationActionName;
  params?: Record<string, string>;
}

export interface AutomationRun {
  id: string;
  startedAt: Date;
  finishedAt?: Date;
  status: "running" | "completed" | "failed";
  summary: string;
  actions: Array<{ name: AutomationActionName; status: "completed" | "failed"; detail: string }>;
}

export interface Automation {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  state?: {
    seen: string[];
    lastScheduleFire?: string;
  };
  lastRunAt?: Date;
  lastStatus?: AutomationRun["status"];
  createdAt: Date;
  runs: AutomationRun[];
}

// ── Daily Briefing ─────────────────────────────────────
export type BriefingSectionName =
  | "meetings"
  | "tasks"
  | "system"
  | "projects"
  | "files"
  | "recommendations";

export interface BriefingConfig {
  sections: Record<BriefingSectionName, boolean>;
  greeting: string;
}

export interface Briefing {
  date: Date;
  greeting: string;
  sections: {
    meetings: { count: number; items: Array<{ title: string; start: string; location?: string; minutes: number }> };
    tasks: { count: number; items: Array<{ title: string; urgent: boolean }> };
    system: { cpu: number; ram: number; disk: number; notes: string[] };
    projects: { count: number; names: string[] };
    files: { count: number; items: string[] };
    recommendations: Array<{ icon: string; text: string; level: "info" | "warn" }>;
  };
}

// ── AI Agents ──────────────────────────────────────────
export type AgentId =
  | "orchestrator"
  | "research"
  | "file"
  | "coding"
  | "design"
  | "productivity"
  | "system"
  | "communication";

export interface AIAgent {
  id: AgentId;
  name: string;
  tagline: string;
  color: string;
  capabilities: string[];
}

// ── App State ──────────────────────────────────────────
export interface AppState {
  sidebarCollapsed: boolean;
  aiState: AIStateInfo;
  activeModel: AIModel | null;
  theme: "dark" | "light";
  isOnline: boolean;
  isLocalAIConnected: boolean;
}

// ── Activity Log ───────────────────────────────────────
export type ActivityKind =
  | "app"
  | "file"
  | "system"
  | "search"
  | "task"
  | "calendar"
  | "automation"
  | "knowledge"
  | "security"
  | "developer"
  | "creative"
  | "chat";

export interface ActivityEvent {
  id: string;
  ts: string;
  actor: "user" | "techy" | "automation";
  kind: ActivityKind;
  action: string;
  detail: string;
  meta?: Record<string, unknown>;
}

// ── Security Center ────────────────────────────────────
export type SecurityLevel = "allowed" | "confirm" | "restricted";
export type SecurityCategory =
  | "fileAccess"
  | "appLaunch"
  | "terminal"
  | "deleteFiles"
  | "systemSettings"
  | "network";

export interface SecurityPolicy {
  fileAccess: SecurityLevel;
  appLaunch: SecurityLevel;
  terminal: SecurityLevel;
  deleteFiles: SecurityLevel;
  systemSettings: SecurityLevel;
  network: SecurityLevel;
  localOnly: boolean;
  logActivity: boolean;
}

// ── Plugin / Tool System ───────────────────────────────
export type PluginCategory = "Core" | "File" | "System" | "Browser" | "Developer" | "Creative" | "Custom";

export interface PluginDef {
  id: string;
  name: string;
  description: string;
  category: PluginCategory;
  permissions: string[];
  inputs: string[];
  outputs: string[];
  builtin?: boolean;
  enabled: boolean;
  execute?: { action: "tool" | "notify" | "text"; tool?: string; args?: Record<string, unknown>; message?: string; output?: string };
}

// ── Developer Mode ─────────────────────────────────────
export interface DevPortInfo {
  proto: string;
  address: string;
  port: number;
  pid: number;
  process: string;
}

export interface DevLogEntry {
  file: string;
  lines: string[];
}

export interface DeveloperSnapshot {
  branch: string;
  status: number;
  statusLines: string[];
  recentCommits: string[];
  packageName: string;
  scripts: Array<{ name: string; command: string }>;
  ports: DevPortInfo[];
  logs: DevLogEntry[];
  nodeProcesses: number;
}

// ── Designer Mode ──────────────────────────────────────
export interface ImageInspection {
  path: string;
  name: string;
  format: "png" | "jpg" | "other";
  width: number;
  height: number;
  bitDepth?: number;
  colorMode?: string;
  bytes: number;
  palette: Array<{ hex: string; share: number }>;
  printInfo?: { ppiEquivalent: number; maxWidthCm: number; maxHeightCm: number; qualifies: boolean };
}

// ── Project Workspaces ─────────────────────────────────
export interface ProjectSummary {
  name: string;
  slug: string;
  files: number;
  documents: number;
  designs: number;
  tasks: number;
  lastActivity: string | null;
}
