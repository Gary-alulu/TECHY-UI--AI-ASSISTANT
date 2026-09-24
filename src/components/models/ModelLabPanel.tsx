"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/context/BrandContext";
import { HUDButton } from "@/components/ui/HUDButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { BlockBar } from "@/components/ui/BlockBar";
import {
  BrainCircuit,
  Cpu,
  Gauge,
  Loader2,
  Power,
  Route,
  Save,
  Zap,
} from "lucide-react";
import type { ModelIntent, RouterRule, PerformanceSample } from "@/types";
import { cn } from "@/lib/utils";

const INTENT_LABEL: Record<ModelIntent, string> = { chat: "Chat", code: "Code", vision: "Vision", embedding: "Embedding" };
const INTENT_COLOR: Record<ModelIntent, string> = {
  chat: "text-cyan-300 border-cyan-400/30 bg-cyan-950/20",
  code: "text-violet-300 border-violet-400/30 bg-violet-950/20",
  vision: "text-emerald-300 border-emerald-400/30 bg-emerald-950/20",
  embedding: "text-amber-300 border-amber-400/30 bg-amber-950/20",
};

interface LabPayload {
  lab: {
    models: Array<{ name: string; sizeGB?: number; loaded: boolean; intent: ModelIntent }>;
    router: RouterRule[];
    settings: { numCtx: number; keepAliveMinutes: number };
  };
  online: boolean;
}

export function ModelLabPanel() {
  const { accent } = useBrand();
  const [lab, setLab] = useState<LabPayload["lab"] | null>(null);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [perf, setPerf] = useState<{ samples: PerformanceSample[]; gpuVram: { usedMB: number; totalMB: number } | null; gpuUtilization: number | null; metrics: Record<string, number | undefined> }>({ samples: [], gpuVram: null, gpuUtilization: null, metrics: {} });

  const load = useCallback(async () => {
    try {
      const [labResponse, perfResponse] = await Promise.all([
        fetch("/api/models", { cache: "no-store" }),
        fetch("/api/models/performance", { cache: "no-store" }),
      ]);
      if (labResponse.ok) {
        const data = (await labResponse.json()) as LabPayload;
        setLab(data.lab);
        setOnline(data.online);
      }
      if (perfResponse.ok) {
        const perfData = (await perfResponse.json()) as typeof perf;
        setPerf(perfData);
      }
    } catch {
      // keep last snapshot
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const toggleModel = useCallback(async (name: string, loaded: boolean) => {
    setSaving(true);
    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", name, loaded }),
      });
      if (response.ok) {
        const data = (await response.json()) as { lab: LabPayload["lab"] };
        setLab(data.lab);
      }
    } finally {
      setSaving(false);
    }
  }, []);

  const updateRule = useCallback((id: string, patch: Partial<RouterRule>) => {
    setLab((current) => (current ? { ...current, router: current.router.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)) } : current));
  }, []);

  const saveRouter = useCallback(async () => {
    if (!lab) return;
    setSaving(true);
    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ router: lab.router }),
      });
      if (response.ok) {
        const data = (await response.json()) as { lab: LabPayload["lab"] };
        setLab(data.lab);
      }
    } finally {
      setSaving(false);
    }
  }, [lab]);

  const loadedCount = lab?.models.filter((model) => model.loaded).length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <GlassPanel className="p-4 flex items-center justify-between gap-3 border-slate-800">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <BrainCircuit size={15} className="text-cyan-400" />
          <span>
            {loading ? "Connecting to Ollama…" : online
              ? `Ollama online · ${lab?.models.length ?? 0} models · ${loadedCount} loaded`
              : "Ollama not reachable — start it, then refresh."}
          </span>
        </div>
        <HUDButton variant="outline" size="sm" className="text-slate-400" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
          Refresh
        </HUDButton>
      </GlassPanel>

      {loading && !lab && (
        <GlassPanel className="p-8 flex items-center justify-center text-slate-500">
          <Loader2 size={20} className="animate-spin text-cyan-400 mr-3" />
          <span className="font-mono text-xs">Fetching model tags from localhost:11434…</span>
        </GlassPanel>
      )}

      {lab && (
        <>
          {/* Local models */}
          <GlassPanel header={`Local Models · ${lab.models.length}`} className="p-5 gap-3 border-slate-800" hudCorners>
            <div className="flex flex-col gap-2.5">
              {lab.models.map((model) => (
                <div key={model.name} className="flex items-center gap-3 rounded-lg bg-navy-950/50 border border-slate-800/70 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-slate-200 truncate">{model.name}</span>
                      <span className={cn("px-1.5 py-0.5 rounded font-mono text-[9px] uppercase tracking-wider border", INTENT_COLOR[model.intent])}>
                        {INTENT_LABEL[model.intent]}
                      </span>
                    </div>
                    {model.sizeGB != null && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <BlockBar percentage={Math.min(100, (model.sizeGB / 8) * 100)} segments={12} filledClassName="bg-violet-400" emptyClassName="bg-slate-800" className="h-1 w-28" />
                        <span className="text-[10px] font-mono text-slate-500">{model.sizeGB.toFixed(1)} GB</span>
                      </div>
                    )}
                  </div>
                  <HUDButton
                    variant={model.loaded ? "default" : "outline"}
                    size="sm"
                    className={model.loaded ? "text-emerald-300 border-emerald-400/30" : "text-slate-400"}
                    onClick={() => void toggleModel(model.name, !model.loaded)}
                    disabled={saving}
                  >
                    <Power size={11} className={cn("mr-1.5", !model.loaded && "opacity-50")} />
                    {model.loaded ? "Loaded" : "Load"}
                  </HUDButton>
                </div>
              ))}
              {lab.models.length === 0 && <p className="text-xs text-slate-500">No models pulled yet — run <span className="font-mono text-cyan-400">ollama pull &lt;model&gt;</span> and refresh.</p>}
            </div>
          </GlassPanel>

          {/* Router */}
          <GlassPanel
            header="Model Router"
            headerAction={
              <HUDButton variant="default" size="sm" onClick={() => void saveRouter()} disabled={saving}>
                {saving ? <Loader2 size={11} className="animate-spin mr-1.5" /> : <Save size={11} className="mr-1.5" />}
                Save rules
              </HUDButton>
            }
            className="p-5 gap-3 border-slate-800"
            hudCorners
          >
            <div className="flex flex-col gap-2.5">
              {(Object.keys(INTENT_LABEL) as ModelIntent[]).map((intent) => {
                const rule = lab.router.find((item) => item.intent === intent);
                if (!rule) return null;
                return (
                  <div key={intent} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg bg-navy-950/50 border border-slate-800/70 px-3 py-2.5">
                    <div className="flex items-center gap-2 sm:w-32 shrink-0">
                      <Route size={12} className="text-cyan-400" />
                      <span className={cn("px-1.5 py-0.5 rounded font-mono text-[9px] uppercase tracking-wider border", INTENT_COLOR[intent])}>
                        {INTENT_LABEL[intent]}
                      </span>
                    </div>
                    <select
                      value={rule.model}
                      onChange={(event) => updateRule(rule.id, { model: event.target.value })}
                      disabled={!rule.enabled}
                      className="flex-1 min-w-0 rounded-md bg-navy-950/70 border border-slate-800 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400/50 disabled:opacity-40"
                    >
                      {lab.models.map((model) => (
                        <option key={model.name} value={model.name}>{model.name}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(event) => updateRule(rule.id, { enabled: event.target.checked })}
                        className="accent-cyan-400"
                      />
                      Enable
                    </label>
                  </div>
                );
              })}
            </div>
          </GlassPanel>

          {/* Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <GlassPanel className="p-4 flex flex-col gap-2 border-slate-800">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500">
                <span className="flex items-center gap-1.5"><Gauge size={11} className="text-cyan-400" /> Tokens / sec</span>
              </div>
              <span className="text-xl font-semibold text-slate-100 text-metric" style={{ color: accent.hex }}>
                {perf.metrics.tokensPerSec ?? "—"}
              </span>
              <span className="text-[11px] font-mono text-slate-500">avg {perf.samples.length} sample{perf.samples.length === 1 ? "" : "s"}</span>
            </GlassPanel>
            <GlassPanel className="p-4 flex flex-col gap-2 border-slate-800">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500">
                <span className="flex items-center gap-1.5"><Cpu size={11} className="text-violet-400" /> GPU util</span>
              </div>
              <span className="text-xl font-semibold text-slate-100 text-metric">
                {perf.gpuUtilization != null ? `${Math.round(perf.gpuUtilization)}%` : "—"}
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {perf.gpuVram ? `VRAM ${perf.gpuVram.usedMB} / ${perf.gpuVram.totalMB} MB` : "no GPU metrics"}
              </span>
            </GlassPanel>
            <GlassPanel className="p-4 flex flex-col gap-2 border-slate-800">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500">
                <span className="flex items-center gap-1.5"><Zap size={11} className="text-amber-400" /> Latency</span>
              </div>
              <span className="text-xl font-semibold text-slate-100 text-metric">
                {perf.metrics.latencyMs ? `${perf.metrics.latencyMs}ms` : "—"}
              </span>
              <span className="text-[11px] font-mono text-slate-500">first-token · context {perf.metrics.contextSize ?? "—"}</span>
            </GlassPanel>
          </div>

          {perf.samples.length > 0 && (
            <GlassPanel header="Recent Inferences" className="p-5 gap-2 border-slate-800">
              <div className="flex flex-col gap-1.5">
                {perf.samples.slice(0, 8).map((sample) => (
                  <div key={sample.id} className="flex items-center gap-3 rounded-lg bg-navy-950/50 border border-slate-800/60 px-3 py-1.5 text-[11px] font-mono">
                    <span className="text-slate-300 flex-1 min-w-0 truncate">{sample.model}</span>
                    <span className="text-slate-500">{sample.totalTokens} tokens</span>
                    <span className="text-cyan-400">{sample.tokensPerSec != null ? `${sample.tokensPerSec}/s` : "—"}</span>
                    <span className="text-slate-600">{sample.latencyMs}ms</span>
                  </div>
                ))}
              </div>
            </GlassPanel>
          )}
        </>
      )}
    </div>
  );
}