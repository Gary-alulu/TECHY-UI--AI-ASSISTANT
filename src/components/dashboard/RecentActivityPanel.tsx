"use client";

import React from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { MessageSquare, Search, FileText, Command } from "lucide-react";
import { cn } from "@/lib/utils";

const activities = [
  { id: 1, type: "chat", content: "Summarized project proposal", time: "2 min ago", icon: MessageSquare, color: "text-cyan-400" },
  { id: 2, type: "search", content: "Found 3 files matching 'Q3 Report'", time: "15 min ago", icon: Search, color: "text-violet-400" },
  { id: 3, type: "file", content: "Analyzed error logs in /var/log", time: "1 hour ago", icon: FileText, color: "text-emerald-400" },
  { id: 4, type: "system", content: "Optimized background processes", time: "3 hours ago", icon: Command, color: "text-amber-400" },
];

export function RecentActivityPanel() {
  return (
    <GlassPanel header="Recent Activity" className="h-full">
      <div className="space-y-4">
        {activities.map((activity, index) => (
          <div key={activity.id} className="relative flex gap-3 group">
            {/* Connection line */}
            {index !== activities.length - 1 && (
              <div className="absolute left-[11px] top-6 bottom-[-16px] w-px bg-slate-800" />
            )}
            
            <div className={cn("relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-navy-950 border border-slate-700", activity.color)}>
              <activity.icon size={10} />
            </div>
            
            <div className="flex-1 pb-1">
              <p className="text-sm text-slate-200 group-hover:text-cyan-300 transition-colors">
                {activity.content}
              </p>
              <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase mt-1 block">
                {activity.time}
              </span>
            </div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
