import { promises as fs } from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "@/lib/system/files";
import { getSecurityPolicy } from "@/lib/security";

const DATA_DIR = path.join(process.cwd(), "data");
const OLLAMA_TAGS = "http://localhost:11434/api/tags";

export interface OfflineService {
  id: string;
  name: string;
  kind: "local" | "cloud";
  optional: boolean;
  status: "ready" | "degraded" | "off";
  note: string;
}

let cachedModel: { name: string; at: number } | null = null;
let cachedNet: { online: boolean; at: number } | null = null;

async function probeModel(): Promise<{ available: boolean; name: string | null }> {
  if (cachedModel && Date.now() - cachedModel.at < 15_000) return { available: true, name: cachedModel.name };
  try {
    const response = await fetch(OLLAMA_TAGS, { signal: AbortSignal.timeout(2500) });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const data = (await response.json()) as { models?: Array<{ name?: string }> };
    const name = (data.models ?? []).find((model) => typeof model.name === "string")?.name ?? null;
    cachedModel = name ? { name, at: Date.now() } : null;
    return { available: Boolean(name), name };
  } catch {
    cachedModel = null;
    return { available: false, name: null };
  }
}

async function probeInternet(): Promise<boolean> {
  if (cachedNet && Date.now() - cachedNet.at < 60_000) return cachedNet.online;
  let online = false;
  try {
    const response = await fetch("https://www.google.com/generate_204", { method: "HEAD", signal: AbortSignal.timeout(4000) });
    online = response.ok;
  } catch {
    online = false;
  }
  cachedNet = { online, at: Date.now() };
  return online;
}

async function listVoice(): Promise<string[]> {
  try {
    const dir = await fs.readdir(path.join(WORKSPACE_ROOT, "src", "app", "voice"), { withFileTypes: true }).catch(() => []);
    void dir;
  } catch {
    // ignore
  }
  return [];
}

export async function getOfflineStatus(): Promise<{
  runningLocally: boolean;
  offlineFirst: boolean;
  internet: boolean;
  localOnly: boolean;
  model: { available: boolean; name: string | null };
  services: OfflineService[];
  voice: string[];
}> {
  const policy = await getSecurityPolicy();
  const model = await probeModel();
  const internet = policy.localOnly ? false : await probeInternet();
  const localOnly = policy.localOnly || !internet;
  const voice = await listVoice();

  const services: OfflineService[] = [
    { id: "ai", name: "Local AI", kind: "local", optional: false, status: model.available ? "ready" : "off", note: model.available ? `Available — ${model.name}` : "Ollama not running — offline skills still work" },
    { id: "files", name: "Files & Documents", kind: "local", optional: false, status: "ready", note: "Search, read, prep and rename on-device" },
    { id: "system", name: "System Monitoring", kind: "local", optional: false, status: "ready", note: "CPU, RAM, GPU, disks, temps, battery" },
    { id: "applications", name: "Applications", kind: "local", optional: false, status: "ready", note: "Discover and launch installed apps" },
    { id: "tasks", name: "Tasks & Reminders", kind: "local", optional: false, status: "ready", note: "Offline store, reminders and automation" },
    { id: "memory", name: "Memory & Knowledge", kind: "local", optional: false, status: "ready", note: "Facts, preferences and knowledge base stored locally" },
    { id: "voice", name: "Voice", kind: "local", optional: true, status: "ready", note: "Browser speech synthesis / recognition when enabled" },
    { id: "model-cloud", name: "Cloud Models", kind: "cloud", optional: true, status: localOnly ? "off" : internet ? "ready" : "off", note: "Optional — TECHY never requires a cloud service" },
  ];

  return { runningLocally: true, offlineFirst: true, internet, localOnly, model, services, voice };
}

export async function ensureDataDirs(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}