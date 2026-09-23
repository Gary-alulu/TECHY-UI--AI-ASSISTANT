"use client";

import React, { useEffect, useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { Bot, SplitSquareHorizontal, ChevronRight, Loader2 } from "lucide-react";
import type { AIAgent } from "@/types";

export function AgentsPanel() {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const frame = requestAnimationFrame(async () => {
      try {
        const response = await fetch("/api/agents", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed");
        const data = (await response.json()) as { agents: AIAgent[] };
        setAgents(data.agents);
      } catch {
        // keep empty
      } finally {
        setLoading(false);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const orchestrator = agents.find((agent) => agent.id === "orchestrator");
  const specialists = agents.filter((agent) => agent.id !== "orchestrator");

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-600">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GlassPanel header="TECHY — Orchestrator" hudCorners className="overflow-hidden">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-950 border border-cyan-400/30 flex items-center justify-center glow-cyan shrink-0">
            <Bot size={22} className="text-cyan-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-200">{orchestrator?.tagline ?? "Routes every request to the right specialist agent."}</p>
            <p className="text-[11px] font-mono text-slate-500 mt-2 leading-relaxed">
              TECHY inspects your request offline and routes it — &ldquo;what&rsquo;s the RAM situation&rdquo; → <span className="text-emerald-400">System Agent</span> ·
              &ldquo;does any document mention invoices?&rdquo; → <span className="text-violet-400">Research Agent</span> ·
              &ldquo;prepare the relevant documents for my meeting&rdquo; → <span className="text-amber-400">File Agent</span>.
              Every offline skill reply is labelled with the agent that handled it in Chat.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {orchestrator?.capabilities.map((capability) => (
                <span key={capability} className="text-[9px] font-mono text-cyan-400/80 bg-cyan-950/30 px-1.5 py-0.5 rounded">{capability}</span>
              ))}
            </div>
          </div>
        </div>
      </GlassPanel>

      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-slate-500">
        <SplitSquareHorizontal size={12} />
        Specialist agents
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
        {specialists.map((agent) => (
          <GlassPanel key={agent.id} className="h-full" padding="md">
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border"
                style={{ backgroundColor: `${agent.color}1a`, borderColor: `${agent.color}40`, color: agent.color }}
              >
                <Bot size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-100">{agent.name}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{agent.tagline}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              {agent.capabilities.map((capability) => (
                <div key={capability} className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                  <ChevronRight size={10} style={{ color: agent.color }} />
                  {capability}
                </div>
              ))}
            </div>
          </GlassPanel>
        ))}
      </div>
    </div>
  );
}