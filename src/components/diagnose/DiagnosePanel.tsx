"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/context/BrandContext";
import { HUDButton } from "@/components/ui/HUDButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Stethoscope, TrendingUp, XCircle } from "lucide-react";
import type { DiagnosticResult } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  normal: { label: "Healthy", badge: "text-emerald-300 border-emerald-400/30 bg-emerald-950/20", dot: "bg-emerald-400" },
  warning: { label: "Elevated", badge: "text-amber-300 border-amber-400/30 bg-amber-950/20", dot: "bg-amber-400" },
  high: { label: "High", badge: "text-red-300 border-red-500/30 bg-red-950/30", dot: "bg-red-500" },
  unknown: { label: "Unknown", badge: "text-slate-400 border-slate-700 bg-slate-800/40", dot: "bg-slate-600" },
};

export function DiagnosePanel() {
  const { brand, accent } = useBrand();
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const run = useCallback(async (initial = false) => {
    if (initial) {
      setLoading(true);
    } else {
      setRunning(true);
    }
    try {
      const response = await fetch("/api/diagnose", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { diagnostic: DiagnosticResult };
        setResult(data.diagnostic);
      }
    } catch {
      // keep last snapshot
    } finally {
      setLoading(false);
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void run(true));
    return () => cancelAnimationFrame(frame);
  }, [run]);

  const warnings = result?.checks.filter((check) => check.status === "high" || check.status === "warning").length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <GlassPanel className="p-4 flex items-center justify-between gap-3 border-slate-800">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <Stethoscope size={15} className="text-cyan-400" />
          <span>
            {loading
              ? "Running diagnostics…"
              : result
                ? warnings > 0
                  ? `${warnings} metric${warnings === 1 ? "" : "s"} outside the healthy range — check the likely cause below.`
                  : "Everything looks healthy — no thresholds exceeded."
                : "No diagnostic yet"}
          </span>
        </div>
        <HUDButton variant="outline" size="sm" className="text-slate-400" onClick={() => void run()} disabled={running || loading}>
          {running ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <RefreshCw size={12} className="mr-1.5" />}
          Re-run diagnostics
        </HUDButton>
      </GlassPanel>

      {loading && !result && (
        <GlassPanel className="p-8 flex items-center justify-center text-slate-500">
          <Loader2 size={20} className="animate-spin text-cyan-400 mr-3" />
          <span className="font-mono text-xs">Sampling CPU, RAM, disks and processes…</span>
        </GlassPanel>
      )}

      {result && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {result.checks.map((check) => (
              <GlassPanel key={check.key} className="p-4 flex flex-col gap-2 border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{check.label}</span>
                  {check.status === "high" ? <XCircle size={13} className="text-red-400 shrink-0" />
                    : check.status === "warning" ? <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                      : check.status === "normal" ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                        : <span className="w-3.5" />}
                </div>
                <span className="text-lg font-semibold text-slate-100 text-metric">{check.value}</span>
                <span className="text-[11px] text-slate-500 leading-snug min-h-8">{check.detail}</span>
                <span className={cn("self-start px-2 py-0.5 rounded-md font-mono text-[10px] uppercase tracking-wider border", STATUS_META[check.status]?.badge ?? STATUS_META.unknown.badge)}>
                  {STATUS_META[check.status]?.label ?? "Unknown"}
                </span>
              </GlassPanel>
            ))}
          </div>

          <GlassPanel className="p-5 flex flex-col gap-3 border-cyan-400/20" hudCorners>
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
              <TrendingUp size={11} className="text-cyan-400" /> Likely cause
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{result.likelyCause}</p>

            {result.processHints.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {result.processHints.map((hint, index) => (
                  <div key={index} className="flex items-center gap-2 rounded-lg bg-navy-950/60 border border-slate-800/70 px-3 py-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent.hex }} />
                    <span className="text-xs text-slate-300">{hint.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">{hint.memoryMB} MB{hint.cpuPercent != null ? ` · ${hint.cpuPercent.toFixed(1)}% CPU` : ""}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-slate-500">
              Tip — ask {brand.aiName} <span className="font-mono text-cyan-400/80">“Close the app using the most memory”</span> to act on this directly.
            </p>
          </GlassPanel>
        </>
      )}
    </div>
  );
}