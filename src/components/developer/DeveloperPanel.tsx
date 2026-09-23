"use client";

import React, { useCallback, useEffect, useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { HUDButton } from "../ui/HUDButton";
import { GitBranch, FileCode2, RadioTower, ScrollText, Loader2, RefreshCw, PackageOpen } from "lucide-react";
import type { DeveloperSnapshot } from "@/types";

export function DeveloperPanel() {
  const [snapshot, setSnapshot] = useState<DeveloperSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/developer", { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { snapshot: DeveloperSnapshot };
      setSnapshot(data.snapshot);
    } catch {
      // keep previous state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(load);
    const interval = setInterval(load, 15_000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
  }, [load]);

  if (loading || !snapshot) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-600">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Workspace · {snapshot.packageName}</p>
        <HUDButton variant="ghost" size="sm" onClick={load}>
          <RefreshCw size={12} />
        </HUDButton>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <GlassPanel header={<span className="flex items-center gap-2"><GitBranch size={14} className="text-emerald-400" /> Git</span>} className="h-full">
          <div className="text-sm text-slate-300 mb-3">
            <span className="font-mono text-emerald-400">{snapshot.branch}</span>
            <span className="ml-2 text-[11px] text-slate-500">{snapshot.status} changed file(s)</span>
          </div>
          {snapshot.statusLines.length > 0 ? (
            <div className="font-mono text-[11px] text-slate-400 space-y-0.5 max-h-56 overflow-y-auto">
              {snapshot.statusLines.map((line, index) => (
                <p key={index} className="truncate">{line}</p>
              ))}
            </div>
          ) : (
            <p className="text-[11px] font-mono text-slate-600">Working tree clean.</p>
          )}
          <div className="mt-4 border-t border-slate-800/50 pt-3">
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2">Recent commits</div>
            <div className="font-mono text-[11px] text-slate-400 space-y-1">
              {snapshot.recentCommits.map((commit, index) => (
                <p key={index} className="truncate">{commit}</p>
              ))}
            </div>
          </div>
        </GlassPanel>

        <GlassPanel header={<span className="flex items-center gap-2"><FileCode2 size={14} className="text-cyan-400" /> Package scripts</span>} className="h-full">
          <div className="grid grid-cols-1 gap-1.5">
            {snapshot.scripts.map((script) => (
              <div key={script.name} className="flex items-center gap-2 text-[11px] font-mono">
                <span className="text-cyan-300 w-24 shrink-0">{script.name}</span>
                <span className="text-slate-500 truncate">{script.command}</span>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel header={<span className="flex items-center gap-2"><RadioTower size={14} className="text-violet-400" /> Local servers · {snapshot.ports.length} listening</span>} className="h-full">
          <div className="font-mono text-[11px] space-y-1 max-h-56 overflow-y-auto">
            {snapshot.ports.length === 0 && <p className="text-slate-600">Nothing listening right now.</p>}
            {snapshot.ports.map((port, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-cyan-400 w-6 text-right">{port.port}</span>
                <span className="text-slate-400 truncate flex-1">{port.process}</span>
                <span className="text-slate-600">pid {port.pid}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-600 mt-3 flex items-center gap-1.5">
            <PackageOpen size={11} /> {snapshot.nodeProcesses} node process(es) running
          </p>
        </GlassPanel>

        <GlassPanel header={<span className="flex items-center gap-2"><ScrollText size={14} className="text-amber-400" /> Recent logs</span>} className="h-full">
          {snapshot.logs.length === 0 ? (
            <p className="text-[11px] font-mono text-slate-600">No server logs detected at the workspace root.</p>
          ) : (
            <div className="space-y-4">
              {snapshot.logs.map((entry) => (
                <div key={entry.file}>
                  <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-1">{entry.file}</p>
                  <pre className="font-mono text-[10px] text-slate-400 bg-navy-950/60 border border-slate-800/50 rounded-lg p-2.5 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {entry.lines.slice(-25).join("\n")}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}