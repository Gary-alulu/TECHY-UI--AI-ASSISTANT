"use client";

import React, { useCallback, useEffect, useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { CalendarDays, CheckSquare, Cpu, FolderKanban, FileDown, Lightbulb, SlidersHorizontal, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Briefing, BriefingConfig, BriefingSectionName } from "@/types";

const SECTION_META: Array<{ key: BriefingSectionName; label: string; icon: React.ReactNode }> = [
  { key: "meetings", label: "Meetings", icon: <CalendarDays size={12} /> },
  { key: "tasks", label: "Tasks", icon: <CheckSquare size={12} /> },
  { key: "system", label: "System", icon: <Cpu size={12} /> },
  { key: "projects", label: "Projects", icon: <FolderKanban size={12} /> },
  { key: "files", label: "Files", icon: <FileDown size={12} /> },
  { key: "recommendations", label: "Recommend", icon: <Lightbulb size={12} /> },
];

export function BriefingPanel() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [config, setConfig] = useState<BriefingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/briefing", { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { briefing: Briefing; config: BriefingConfig };
      setBriefing(data.briefing);
      setConfig(data.config);
    } catch {
      // dashboard works without it
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(load);
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const toggle = async (key: BriefingSectionName, value: boolean) => {
    if (!config) return;
    const next = { ...config, sections: { ...config.sections, [key]: value } };
    setConfig(next);
    try {
      await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: { [key]: value } }),
      });
      await load();
    } catch {
      // keep optimistic state
    }
  };

  if (loading) {
    return (
      <GlassPanel header="Daily Briefing" className="flex items-center justify-center py-8">
        <Loader2 size={18} className="animate-spin text-slate-600" />
      </GlassPanel>
    );
  }

  if (!briefing) return null;
  const { sections } = briefing;

  return (
    <GlassPanel
      header="Daily Briefing"
      headerAction={
        <button type="button" onClick={() => setShowConfig((value) => !value)} className="p-1.5 rounded-md text-slate-500 hover:text-cyan-300 hover:bg-slate-800/50" title="Configure sections">
          <SlidersHorizontal size={14} />
        </button>
      }
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-display text-xl font-semibold text-slate-100 tracking-wide leading-tight">{briefing.greeting}</p>
        <button type="button" onClick={load} className="p-1.5 rounded text-slate-600 hover:text-cyan-300" title="Refresh">
          <RefreshCw size={13} />
        </button>
      </div>
      <p className="text-[10px] font-mono text-slate-500 mt-1">
        {new Date(briefing.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      </p>

      {showConfig && (
        <div className="mt-3 p-2.5 rounded-lg border border-slate-800/60 bg-navy-950/50 grid grid-cols-2 gap-1.5">
          {SECTION_META.map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key, !(config?.sections[key] ?? true))}
              className={cn("flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono transition-colors", config?.sections[key] ? "text-cyan-300 bg-cyan-950/20" : "text-slate-600")}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-2.5 text-[12px]">
        {sections.meetings.count > 0 && (
          <div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-violet-400 mb-1">Today · {sections.meetings.count} meeting{sections.meetings.count === 1 ? "" : "s"}</div>
            <div className="space-y-1">
              {sections.meetings.items.slice(0, 3).map((meeting, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-300 w-10 shrink-0">{new Date(meeting.start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="text-slate-400 truncate">{meeting.title}{meeting.location ? <span className="text-slate-600"> · {meeting.location}</span> : null}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {sections.tasks.count > 0 && (
          <div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-sky-400 mb-1">Tasks · {sections.tasks.count}</div>
            <div className="space-y-0.5">
              {sections.tasks.items.slice(0, 3).map((task, index) => (
                <div key={index} className="flex items-center gap-1.5 text-slate-400 truncate">
                  {task.urgent ? <span className="text-rose-400">⚠</span> : <span className="text-slate-600">•</span>}
                  {task.title}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 mb-1">System</div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-slate-500">CPU {sections.system.cpu}%</span>
            <span className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
              <span className={cn("block h-full rounded-full", sections.system.cpu > 85 ? "bg-red-500" : "bg-cyan-500")} style={{ width: `${sections.system.cpu}%` }} />
            </span>
            <span className="text-[10px] font-mono text-slate-500">{sections.system.ram}% RAM</span>
            <span className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
              <span className="block h-full rounded-full bg-cyan-500" style={{ width: `${sections.system.ram}%` }} />
            </span>
          </div>
          {sections.system.notes.map((note, index) => (
            <p key={index} className="text-[11px] text-amber-400/80 mt-0.5">{note}</p>
          ))}
        </div>

        {sections.projects.count > 0 && (
          <p className="text-[11px] text-slate-400">
            <span className="text-[9px] font-mono uppercase tracking-widest text-cyan-400 mr-2">Projects</span>
            {sections.projects.count} active — {sections.projects.names.slice(0, 3).join(", ")}
          </p>
        )}

        {sections.files.count > 0 && (
          <p className="text-[11px] text-slate-400">
            <span className="text-[9px] font-mono uppercase tracking-widest text-cyan-400 mr-2">Files</span>
            {sections.files.count} received — {sections.files.items.slice(0, 3).join(", ")}
          </p>
        )}

        {sections.recommendations.length > 0 && (
          <div className="pt-1.5 border-t border-slate-800/50">
            <div className="text-[9px] font-mono uppercase tracking-widest text-amber-400 mb-1.5">TECHY recommends</div>
            <div className="space-y-1.5">
              {sections.recommendations.map((recommendation, index) => (
                <div
                  key={index}
                  className={cn("p-2 rounded-lg text-[11px] leading-snug", recommendation.level === "warn" ? "bg-amber-500/10 border border-amber-500/20 text-amber-200/90" : "bg-navy-950/50 border border-slate-800/50 text-slate-300")}
                >
                  {recommendation.icon} {recommendation.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </GlassPanel>
  );
}