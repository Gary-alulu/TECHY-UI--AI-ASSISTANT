import { promises as fs } from "node:fs";
import path from "node:path";
import type { LocalModelEntry, ModelIntent, ModelLabState, PerformanceSample, RouterRule } from "@/types";
import { randomUUID } from "node:crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const LAB_FILE = path.join(DATA_DIR, "modellab.json");
const PERF_FILE = path.join(DATA_DIR, "performance.json");

const OLLAMA_TAGS = "http://localhost:11434/api/tags";
const MAX_PERF_SAMPLES = 100;

export const DEFAULT_LAB: ModelLabState = {
  models: [],
  router: [
    { id: "router-chat", intent: "chat", model: "auto", enabled: true },
    { id: "router-code", intent: "code", model: "auto", enabled: true },
    { id: "router-vision", intent: "vision", model: "auto", enabled: true },
    { id: "router-embedding", intent: "embedding", model: "auto", enabled: true },
  ],
  loadedModelNames: [],
  settings: { numCtx: 8192, keepAliveMinutes: 5 },
  updatedAt: new Date(0).toISOString(),
};

function intentFor(name: string): ModelIntent {
  const lower = name.toLowerCase();
  if (/llava|vision|moondream|bakllava|qwen.*vl|phi.*vision/.test(lower)) return "vision";
  if (/codellama|qwen.*coder|deepseek.*coder|starcoder|coder/.test(lower)) return "code";
  if (/embed|bge|nomic.*embed|minilm/.test(lower)) return "embedding";
  return "chat";
}

async function readLab(): Promise<ModelLabState> {
  try {
    const raw = await fs.readFile(LAB_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_LAB, ...parsed, settings: { ...DEFAULT_LAB.settings, ...(parsed.settings ?? {}) } };
  } catch {
    return { ...DEFAULT_LAB, updatedAt: new Date().toISOString() };
  }
}

let labQueue: Promise<unknown> = Promise.resolve();

function queueLabWrite(updater: (lab: ModelLabState) => ModelLabState): Promise<ModelLabState> {
  const run = labQueue.then(async () => {
    const next = updater(await readLab());
    next.updatedAt = new Date().toISOString();
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(LAB_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
  labQueue = run.catch(() => {});
  return run;
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string; size?: number; details?: { family?: string } }>;
}

export async function fetchOllamaModels(): Promise<Array<{ name: string; sizeGB?: number }>> {
  try {
    const response = await fetch(OLLAMA_TAGS, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return [];
    const data = (await response.json()) as OllamaTagsResponse;
    return (data.models ?? [])
      .filter((model) => typeof model.name === "string" && model.name)
      .map((model) => ({
        name: model.name as string,
        sizeGB: typeof model.size === "number" ? Number((model.size / 1024 ** 3).toFixed(2)) : undefined,
      }));
  } catch {
    return [];
  }
}

/** Merges live Ollama models with the persisted lab state. */
export async function getLab(): Promise<{ lab: ModelLabState; online: boolean }> {
  const stored = await readLab();
  const live = await fetchOllamaModels();
  const online = live.length > 0;

  const merged = new Map<string, LocalModelEntry>();

  for (const entry of stored.models) {
    merged.set(entry.name, { ...entry, loaded: stored.loadedModelNames.includes(entry.name) });
  }
  for (const model of live) {
    const existing = merged.get(model.name);
    merged.set(model.name, {
      name: model.name,
      sizeGB: model.sizeGB ?? existing?.sizeGB,
      loaded: stored.loadedModelNames.includes(model.name) || !stored.loadedModelNames.length,
      intent: existing?.intent ?? intentFor(model.name),
    });
  }

  const models = Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
  return { lab: { ...stored, models, updatedAt: stored.updatedAt }, online };
}

export async function saveLab(patch: Partial<Pick<ModelLabState, "router" | "loadedModelNames" | "settings">>): Promise<ModelLabState> {
  return queueLabWrite((lab) => {
    if (Array.isArray(patch.router)) {
      lab.router = patch.router
        .map((rule: RouterRule) => ({
          id: rule.id || `router-${rule.intent}`,
          intent: rule.intent,
          model: (rule.model || "auto").trim().slice(0, 80),
          enabled: rule.enabled !== false,
        }))
        .slice(0, 8);
    }
    if (Array.isArray(patch.loadedModelNames)) {
      lab.loadedModelNames = patch.loadedModelNames.map((name) => String(name)).slice(0, 6);
    }
    if (patch.settings) {
      const ctx = Number(patch.settings.numCtx);
      const keep = Number(patch.settings.keepAliveMinutes);
      lab.settings = {
        numCtx: Number.isFinite(ctx) ? Math.min(Math.max(ctx, 2048), 131_072) : lab.settings.numCtx,
        keepAliveMinutes: Number.isFinite(keep) ? Math.min(Math.max(keep, 1), 1440) : lab.settings.keepAliveMinutes,
      };
    }
    return lab;
  });
}

export async function toggleLoadModel(name: string, loaded: boolean): Promise<ModelLabState> {
  return queueLabWrite((lab) => {
    const set = new Set(lab.loadedModelNames);
    if (loaded) set.add(name);
    else set.delete(name);
    lab.loadedModelNames = Array.from(set);
    return lab;
  });
}

/** Deterministic intent → model selection using the router rules (falls back to the first model). */
export async function routeIntent(intent: ModelIntent): Promise<{ model: string; rule?: RouterRule }> {
  const { lab } = await getLab();
  const rule = lab.router.find((entry) => entry.intent === intent && entry.enabled);
  if (rule && rule.model && rule.model !== "auto") return { model: rule.model, rule };
  const candidates = lab.models.filter((model) => (model.intent === intent ? true : model.intent === "chat"));
  const preferred = lab.models.find((model) => lab.loadedModelNames.includes(model.name));
  return { model: candidates[0]?.name ?? preferred?.name ?? lab.models[0]?.name ?? "", rule };
}

// ── Performance ───────────────────────────────────────

let perfQueue: Promise<unknown> = Promise.resolve();

async function readSamples(): Promise<PerformanceSample[]> {
  try {
    const raw = await fs.readFile(PERF_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeSamples(updater: (samples: PerformanceSample[]) => PerformanceSample[]): Promise<PerformanceSample[]> {
  const run = perfQueue.then(async () => {
    const next = updater(await readSamples());
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(PERF_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
  perfQueue = run.catch(() => {});
  return run;
}

export async function recordPerformance(input: {
  model: string;
  latencyMs: number;
  inferenceTimeMs?: number;
  contextSize?: number;
  totalTokens?: number;
  tokensPerSec?: number | null;
  gpuUtilization?: number | null;
}): Promise<void> {
  const sample: PerformanceSample = {
    id: randomUUID(),
    model: input.model.slice(0, 80),
    tokensPerSec:
      input.tokensPerSec ??
      (input.inferenceTimeMs && input.totalTokens
        ? Math.round((input.totalTokens / input.inferenceTimeMs) * 1000 * 10) / 10
        : null),
    latencyMs: Math.round(input.latencyMs),
    gpuUtilization: input.gpuUtilization ?? null,
    contextSize: input.contextSize ?? 8192,
    inferenceTimeMs: Math.round(input.inferenceTimeMs ?? input.latencyMs),
    totalTokens: input.totalTokens ?? 0,
    createdAt: new Date().toISOString(),
  };
  await writeSamples((samples) => [sample, ...samples].slice(0, MAX_PERF_SAMPLES));
}

export async function getPerformanceSamples(limit = 20): Promise<PerformanceSample[]> {
  return (await readSamples()).slice(0, Math.min(limit, MAX_PERF_SAMPLES));
}
