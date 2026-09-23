"use client";

import React, { useCallback, useEffect, useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { HUDButton } from "../ui/HUDButton";
import { Loader2, Trash2, MonitorPlay, FileText, Cpu, Search, CheckSquare, CalendarDays, Workflow, BookOpen, Shield, Code2, Palette, MessageSquare, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityEvent, ActivityKind } from "@/types";

const KIND_META: Record<ActivityKind, { icon: React.ReactNode; color: string }> = {
  app: { icon: <MonitorPlay size={11} />, color: "text-amber-400" },
  file: { icon: <FileText size={11} />, color: "text-emerald-400" },
  system: { icon: <Cpu size={11} />, color: "text-violet-400" },
  search: { icon: <Search size={11} />, color: "text-sky-400" },
  task: { icon: <CheckSquare size={11} />, color: "text-cyan-400" },
  calendar: { icon: <CalendarDays size={11} />, color: "text-fuchsia-400" },
  automation: { icon: <Workflow size={11} />, color: "text-indigo-400" },
  knowledge: { icon: <BookOpen size={11} />, color: "text-purple-400" },
  security: { icon: <Shield size={11} />, color: "text-green-400" },
  developer: { icon: <Code2 size={11} />, color: "text-amber-300" },
  creative: { icon: <Palette size={11} />, color: "text-rose-400" },
  chat: { icon: <MessageSquare size={11} />, color: "text-slate-400" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ActivityPanel() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [selected, setSelected] = useState<ActivityEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<ActivityKind | "all">("all");

  const load = useCallback(async () => {
    try {
      const query = kindFilter === "all" ? "" : `?kind=${kindFilter}`;
      const response = await fetch(`/api/activity${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { activities: ActivityEvent[] };
      setEvents(data.activities);
    } catch {
      // keep
    } finally {
      setLoading(false);
    }
  }, [kindFilter]);

  useEffect(() => {
    const frame = requestAnimationFrame(load);
    const interval = setInterval(load, 10_000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
  }, [load]);

  const clear = async () => {
    try {
      await fetch("/api/activity", { method: "DELETE" });
      setSelected(null);
      await load();
    } catch {
      // ignore
    }
  };

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "file", "system", "task", "automation", "developer", "creative", "security", "search", "app", "knowledge", "calendar", "chat"] as Array<ActivityKind | "all">).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setKindFilter(kind)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider border transition-colors",
                kindFilter === kind ? "bg-cyan-950/40 border-cyan-400/30 text-cyan-300" : "border-slate-800/50 text-slate-600 hover:text-slate-300"
              )}
            >
              {kind === "all" ? `all (${events.length})` : kind}
            </button>
          ))}
        </div>
        <HUDButton variant="ghost" size="sm" onClick={clear}>
          <Trash2 size={12} /> Clear
        </HUDButton>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-slate-600"><Loader2 size={18} className="animate-spin" /></div>
      ) : events.length === 0 ? (
        <GlassPanel className="text-center py-10">
          <p className="text-[11px] font-mono text-slate-600">No activity recorded yet. Ask TECHY to open an app, read a file or run an automation and it will show up here.</p>
        </GlassPanel>
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const meta = KIND_META[event.kind];
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => setSelected(selected?.id === event.id ? null : event)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-colors",
                  selected?.id === event.id ? "border-cyan-400/30 bg-cyan-950/20" : "border-slate-800/40 bg-navy-950/40 hover:border-slate-700"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn("w-6 h-6 rounded-full bg-navy-950 border border-slate-700 flex items-center justify-center shrink-0", meta.color)}>{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-200 truncate">{event.action}</p>
                    <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5">{event.detail}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-[9px] font-mono text-slate-600">{timeAgo(event.ts)}</span>
                    <ChevronRight size={12} className={cn("text-slate-600 transition-transform", selected?.id === event.id && "rotate-90")} />
                  </div>
                </div>
                {selected?.id === event.id && (
                  <div className="mt-3 pt-3 border-t border-slate-800/50 text-[10px] font-mono text-slate-500 leading-relaxed">
                    <p><span className="text-slate-400">Actor:</span> {event.actor} · <span className="text-slate-400">Kind:</span> {event.kind}</p>
                    <p><span className="text-slate-400">At:</span> {new Date(event.ts).toLocaleString()}</p>
                    {event.meta && Object.keys(event.meta).length > 0 && (
                      <pre className="mt-2 text-slate-400 bg-navy-950/60 border border-slate-800/50 rounded-lg p-2 whitespace-pre-wrap">{JSON.stringify(event.meta, null, 2)}</pre>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}