"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GlassPanel } from "../ui/GlassPanel";
import { MessageSquare, Search, FileText, Command, CalendarDays, Workflow, Palette, Code2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityEvent } from "@/types";

const FALLBACK: ActivityEvent[] = [
  { id: "fb1", actor: "techy", kind: "chat", action: "Summarized project proposal", detail: "Via chat skill", ts: new Date(Date.now() - 2 * 60_000).toISOString() },
  { id: "fb2", actor: "techy", kind: "search", action: "Found 3 files matching invoices", detail: "Knowledge search", ts: new Date(Date.now() - 15 * 60_000).toISOString() },
  { id: "fb3", actor: "techy", kind: "file", action: "Prepared documents for Client Meeting", detail: "Meeting prep", ts: new Date(Date.now() - 60 * 60_000).toISOString() },
  { id: "fb4", actor: "techy", kind: "system", action: "Checked system metrics", detail: "Startup greeting", ts: new Date(Date.now() - 3 * 60 * 60_000).toISOString() },
];

const ICONS: Record<string, React.ReactNode> = {
  app: <Command size={10} />,
  file: <FileText size={10} />,
  system: <Command size={10} />,
  search: <Search size={10} />,
  calendar: <CalendarDays size={10} />,
  automation: <Workflow size={10} />,
  developer: <Code2 size={10} />,
  creative: <Palette size={10} />,
  chat: <MessageSquare size={10} />,
};

const COLORS: Record<string, string> = {
  app: "text-amber-400",
  file: "text-emerald-400",
  system: "text-violet-400",
  search: "text-sky-400",
  calendar: "text-fuchsia-400",
  automation: "text-indigo-400",
  developer: "text-amber-300",
  creative: "text-rose-400",
  chat: "text-cyan-400",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

export function RecentActivityPanel() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/activity?limit=5", { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { activities: ActivityEvent[] };
      setEvents(data.activities.length > 0 ? data.activities : FALLBACK);
    } catch {
      setEvents(FALLBACK);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(load);
    return () => cancelAnimationFrame(frame);
  }, [load]);

  return (
    <GlassPanel
      header={
        <Link href="/activity" className="flex items-center gap-1.5 hover:text-cyan-300 transition-colors">
          Recent Activity
          <span className="text-[9px] font-mono text-slate-600">→ log</span>
        </Link>
      }
      className="h-full"
    >
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-slate-700"><Loader2 size={16} className="animate-spin" /></div>
        ) : (
          events.map((activity, index) => {
            const icon = ICONS[activity.kind] ?? <MessageSquare size={10} />;
            const color = COLORS[activity.kind] ?? "text-slate-400";
            return (
              <div key={activity.id} className="relative flex gap-3 group">
                {index !== events.length - 1 && <div className="absolute left-[11px] top-6 bottom-[-16px] w-px bg-slate-800" />}
                <div className={cn("relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-navy-950 border border-slate-700", color)}>
                  {icon}
                </div>
                <div className="flex-1 pb-1 min-w-0">
                  <p className="text-sm text-slate-200 group-hover:text-cyan-300 transition-colors truncate">{activity.action}</p>
                  <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase mt-1 block">{timeAgo(activity.ts)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </GlassPanel>
  );
}