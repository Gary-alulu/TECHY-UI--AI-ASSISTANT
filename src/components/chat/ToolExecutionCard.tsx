"use client";

import React, { useState } from "react";
import { ToolExecution } from "@/types";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface ToolExecutionCardProps {
  execution: ToolExecution;
}

export function ToolExecutionCard({ execution }: ToolExecutionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { status, toolName, output, error } = execution;

  const getStatusColor = () => {
    switch (status) {
      case "completed": return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
      case "failed": return "text-red-400 bg-red-400/10 border-red-400/20";
      case "running": return "text-cyan-400 bg-cyan-400/10 border-cyan-400/20";
      default: return "text-slate-400 bg-slate-800/50 border-slate-700/50";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "completed": return <CheckCircle2 size={14} className="text-emerald-400" />;
      case "failed": return <AlertCircle size={14} className="text-red-400" />;
      case "running": return <Loader2 size={14} className="animate-spin text-cyan-400" />;
      default: return null;
    }
  };

  return (
    <div className="rounded-lg border border-slate-800/60 bg-navy-950/40 overflow-hidden font-mono text-xs">
      <div 
        className={cn(
          "flex items-center justify-between px-3 py-2 cursor-pointer transition-colors hover:bg-slate-800/40",
          getStatusColor(), "bg-opacity-50"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-semibold uppercase tracking-wider">{toolName}</span>
          <span className="text-slate-500 lowercase opacity-75">({status})</span>
        </div>
        <button className="text-slate-400 hover:text-slate-200">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && (output || error) && (
        <div className="p-3 bg-[#0a0a0a] text-slate-300 border-t border-slate-800/60 overflow-x-auto">
          {error ? (
            <div className="text-red-400 whitespace-pre-wrap">{error}</div>
          ) : (
            <div className="whitespace-pre-wrap text-cyan-300/80">{output}</div>
          )}
        </div>
      )}
    </div>
  );
}
