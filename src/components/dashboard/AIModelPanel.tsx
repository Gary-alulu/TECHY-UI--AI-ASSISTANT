"use client";

import React from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { useApp } from "@/context/AppContext";
import { Cpu, Zap, Activity } from "lucide-react";
import { StatusIndicator } from "../ui/StatusIndicator";

export function AIModelPanel() {
  const { activeModel, isLocalAIConnected } = useApp();

  if (!activeModel) return null;

  return (
    <GlassPanel header="AI Provider" className="h-full">
      <div className="flex flex-col h-full justify-between">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-display font-semibold text-slate-100">{activeModel.name}</h3>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest bg-violet-500/20 text-violet-300 border border-violet-500/30">
                {activeModel.provider}
              </span>
            </div>
            <div className="text-xs text-slate-400">Context: {activeModel.contextLength} tokens</div>
          </div>
          <StatusIndicator status={isLocalAIConnected ? "online" : "error"} />
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <div className="p-3 rounded-lg bg-navy-950/50 border border-slate-800/50">
            <div className="flex items-center gap-2 mb-2 text-slate-400">
              <Cpu size={14} />
              <span className="text-[10px] font-mono uppercase tracking-wider">VRAM</span>
            </div>
            <div className="text-sm font-medium text-cyan-400">{activeModel.ramUsage}</div>
          </div>
          
          <div className="p-3 rounded-lg bg-navy-950/50 border border-slate-800/50">
            <div className="flex items-center gap-2 mb-2 text-slate-400">
              <Zap size={14} />
              <span className="text-[10px] font-mono uppercase tracking-wider">Speed</span>
            </div>
            <div className="text-sm font-medium text-emerald-400">42 t/s</div>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-800/50 flex items-center justify-between text-xs text-slate-500 font-mono">
          <span className="flex items-center gap-1.5">
            <Activity size={12} className="text-cyan-400" /> API Active
          </span>
          <span>localhost:11434</span>
        </div>
      </div>
    </GlassPanel>
  );
}
