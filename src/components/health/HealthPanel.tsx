"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/context/BrandContext";
import { HUDButton } from "@/components/ui/HUDButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { CircularGauge } from "@/components/ui/CircularGauge";
import { AlertTriangle, CheckCircle2, HeartPulse, Loader2, RefreshCw, XCircle } from "lucide-react";
import type { SystemHealth } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  ok: { label: "OK", badge: "text-emerald-300 border-emerald-400/30 bg-emerald-950/20", dot: "bg-emerald-400" },
  warn: { label: "Warn", badge: "text-amber-300 border-amber-400/30 bg-amber-950/20", dot: "bg-amber-400" },
  fail: { label: "Fail", badge: "text-red-300 border-red-500/30 bg-red-950/30", dot: "bg-red-500" },
};

function scoreColor(ratio: number): string {
  return ratio >= 0.85 ? "text-emerald-400" : ratio >= 0.6 ? "text-amber-400" : "text-red-400";
}

export function HealthPanel() {
  const { accent } = useBrand();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const run = useCallback(async (initial = false) => {
    if (initial) {
      setLoading(true);
    } else {
      setRunning(true);
    }
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { health: SystemHealth };
        setHealth(data.health);
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

  const percentage = health ? Math.round((health.score / health.maxScore) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <GlassPanel className="p-4 flex items-center justify-between gap-3 border-slate-800">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <HeartPulse size={15} className="text-cyan-400" />
          <span>
            {loading ? "Assessing system health…" : health
              ? percentage >= 85
                ? "This machine is in great shape."
                : percentage >= 60
                  ? "Decent, but a few checks are worth attention."
                  : "Several checks are failing — review the details below."
              : "No assessment yet"}
          </span>
        </div>
        <HUDButton variant="outline" size="sm" className="text-slate-400" onClick={() => void run()} disabled={running || loading}>
          {running ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <RefreshCw size={12} className="mr-1.5" />}
          Re-assess
        </HUDButton>
      </GlassPanel>

      {loading && !health && (
        <GlassPanel className="p-8 flex items-center justify-center text-slate-500">
          <Loader2 size={20} className="animate-spin text-cyan-400 mr-3" />
          <span className="font-mono text-xs">Scoring CPU, RAM, storage, GPU and thermal…</span>
        </GlassPanel>
      )}

      {health && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <GlassPanel className="p-6 flex flex-col items-center justify-center gap-3 border-slate-800" hudCorners>
            <CircularGauge percentage={percentage} label="Health" size={150} color={scoreColor(percentage / 100)} icon={<HeartPulse size={18} />} />
            <div className="text-center">
              <div className="font-mono text-sm" style={{ color: accent.hex }}>{health.score} / {health.maxScore}</div>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-mono">points · transparent score</p>
            </div>
          </GlassPanel>

          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {health.checks.map((check) => (
              <GlassPanel key={check.key} className="p-4 flex flex-col gap-2 border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{check.label}</span>
                  <span className={cn("px-2 py-0.5 rounded-md font-mono text-[10px] uppercase tracking-wider border", STATUS_META[check.status]?.badge ?? STATUS_META.ok.badge)}>
                    {STATUS_META[check.status]?.label ?? "OK"}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 leading-snug min-h-8">{check.detail}</span>
                <div className="mt-auto flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span className="flex items-center gap-1">
                    {check.status === "fail" ? <XCircle size={10} className="text-red-400" />
                      : check.status === "warn" ? <AlertTriangle size={10} className="text-amber-400" />
                        : <CheckCircle2 size={10} className="text-emerald-400" />}
                    points
                  </span>
                  <span className="text-slate-300">{check.points} / {check.maxPoints}</span>
                </div>
              </GlassPanel>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}