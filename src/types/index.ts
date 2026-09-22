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
  network: NetworkMetric;
  interfaces: NetworkInterfaceInfo[];
  machine: MachineInfo;
  battery: BatteryMetric | null;
  uptime: number;
  source: "live";
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
export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: Date;
  dueTime?: string;
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
}

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

// ── App State ──────────────────────────────────────────
export interface AppState {
  sidebarCollapsed: boolean;
  aiState: AIStateInfo;
  activeModel: AIModel | null;
  theme: "dark" | "light";
  isOnline: boolean;
  isLocalAIConnected: boolean;
}
