"use client";

import React, { useEffect, useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { cn } from "@/lib/utils";
import type { ProcessInfo } from "@/types";

export function ProcessListPanel() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/system/processes?limit=25", { cache: "no-store" });
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        const data = (await response.json()) as { processes: ProcessInfo[] };
        if (cancelled) return;
        setProcesses(data.processes ?? []);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load processes");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setUpdatedAt(new Date());
        }
      }
    };

    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <GlassPanel
      header="Process List"
      className="flex-1 min-h-0"
      headerAction={
        <span className={cn("text-[9px] font-mono uppercase tracking-widest", error ? "text-rose-400" : "text-slate-500")}>
          {loading ? "Refreshing…" : `${processes.length} running`}
        </span>
      }
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Column Headers */}
        <div className="grid grid-cols-[1fr_3.5rem_3.5rem_4.5rem] gap-2 px-2 pb-1 text-[9px] uppercase tracking-widest text-slate-600 font-mono shrink-0">
          <span>Name</span>
          <span className="text-right">PID</span>
          <span className="text-right">Mem</span>
          <span className="text-right">Status</span>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto min-h-0 rounded-lg border border-slate-800/50 bg-navy-950/40">
          {error && !loading && (
            <div className="flex items-center justify-center h-full text-slate-500 font-mono text-xs px-4 text-center">
              {error}
            </div>
          )}

          {!error && processes.length === 0 && (
            <div className="flex items-center justify-center h-full text-slate-600 font-mono text-xs animate-pulse">
              {loading ? "Reading processes…" : "No processes found"}
            </div>
          )}

          <div className="divide-y divide-slate-800/40">
            {processes.map((process, index) => (
              <div
                key={`${process.name}-${process.pid}`}
                className="grid grid-cols-[1fr_3.5rem_3.5rem_4.5rem] gap-2 px-2 py-1.5 items-center hover:bg-slate-800/30 transition-colors"
                title={process.path || `${process.name} (${process.pid})`}
              >
                <span className="text-xs text-slate-300 font-mono truncate">
                  <span className="text-slate-600 mr-1.5">{String(index + 1).padStart(2, "0")}</span>
                  {process.name}
                </span>
                <span className="text-xs text-slate-500 font-mono text-right">{process.pid}</span>
                <span className="text-xs text-cyan-400 font-mono text-right">{process.memoryMB}</span>
                <span className="flex items-center justify-end gap-1">
                  <span
                    className={cn(
                      "w-1 h-1 rounded-full shrink-0",
                      process.responding === false ? "bg-rose-500" : "bg-emerald-500/70"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[9px] font-mono uppercase tracking-wider",
                      process.responding === false ? "text-rose-400" : "text-slate-500"
                    )}
                  >
                    {process.responding === false ? "Stuck" : "Run"}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-1.5 text-[9px] text-slate-600 font-mono">
          {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : "Auto-refresh every 5s"}
        </div>
      </div>
    </GlassPanel>
  );
}