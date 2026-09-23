"use client";

import React, { useEffect, useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { PlayCircle, Rocket, AlertTriangle } from "lucide-react";
import type { StartupApp } from "@/types";

export function StartupAppsPanel() {
  const [apps, setApps] = useState<StartupApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/system/startup", { cache: "no-store" });
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        const data = (await response.json()) as { startupApps: StartupApp[] };
        if (cancelled) return;
        setApps(data.startupApps ?? []);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load startup items");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <GlassPanel
      header="Startup Applications"
      className="flex-1 min-h-0"
      headerAction={
        <span className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-slate-500">
          <Rocket size={11} className="text-amber-400" />
          {loading ? "Scanning…" : `${apps.length} at boot`}
        </span>
      }
    >
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-1 overflow-y-auto min-h-0 rounded-lg border border-slate-800/50 bg-navy-950/40">
          {error && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500 px-4 text-center">
              <AlertTriangle size={16} />
              <span className="text-xs font-mono">{error}</span>
            </div>
          )}

          {!error && apps.length === 0 && (
            <div className="flex items-center justify-center h-full text-slate-600 font-mono text-xs animate-pulse">
              {loading ? "Reading startup items…" : "No startup applications found"}
            </div>
          )}

          <div className="divide-y divide-slate-800/40">
            {apps.map((app, index) => (
              <div
                key={`${app.name}-${index}`}
                className="flex items-start gap-2.5 px-2.5 py-2 hover:bg-slate-800/30 transition-colors"
                title={app.command || app.location}
              >
                <PlayCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-300 font-mono truncate">
                    <span className="text-slate-600 mr-1.5">{String(index + 1).padStart(2, "0")}</span>
                    {app.name}
                  </div>
                  <div className="text-[9px] font-mono text-slate-600 truncate">
                    {app.location?.replace(/^.*\\|^.*\//, "") || app.user || "startup entry"}
                  </div>
                </div>
                <span className="text-[9px] font-mono text-slate-600 shrink-0">{app.user ?? ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}