"use client";

import React, { useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { Globe, Terminal, FileCode, MonitorPlay, PenTool, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { QUICK_APPS } from "@/lib/apps/catalog";

const PRESENTATION: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  browser: { icon: Globe, color: "text-blue-400", bg: "bg-blue-400/10" },
  vscode: { icon: FileCode, color: "text-blue-500", bg: "bg-blue-500/10" },
  terminal: { icon: Terminal, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  figma: { icon: PenTool, color: "text-pink-400", bg: "bg-pink-400/10" },
  github: { icon: GitBranch, color: "text-slate-200", bg: "bg-slate-700/30" },
  media: { icon: MonitorPlay, color: "text-violet-400", bg: "bg-violet-400/10" },
};

const apps = Object.values(QUICK_APPS).map((app) => ({
  ...app,
  ...(PRESENTATION[app.id] ?? {
    icon: Globe,
    color: "text-slate-300",
    bg: "bg-slate-700/30",
  }),
}));

type AppStatus = "idle" | "launching" | "launched" | "error";

export function QuickAppsPanel() {
  const [statuses, setStatuses] = useState<Record<string, AppStatus>>({});

  const setStatus = (id: string, status: AppStatus) =>
    setStatuses((prev) => ({ ...prev, [id]: status }));

  const handleLaunch = async (app: (typeof apps)[number]) => {
    if (statuses[app.id] === "launching") return;
    setStatus(app.id, "launching");

    try {
      const res = await fetch("/api/apps/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: app.id }),
      });
      const data = await res.json();

      if (!data?.ok) throw new Error(data?.error ?? "Launch failed");
      setStatus(app.id, "launched");
    } catch {
      if (app.url) {
        window.open(app.url, "_blank", "noopener,noreferrer");
        setStatus(app.id, "launched");
      } else {
        setStatus(app.id, "error");
      }
    }

    window.setTimeout(() => setStatus(app.id, "idle"), 3000);
  };

  return (
    <GlassPanel header="Quick Apps" className="h-full">
      <div className="grid grid-cols-3 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {apps.map((app) => {
          const status = statuses[app.id] ?? "idle";
          const launching = status === "launching";

          return (
            <button
              key={app.id}
              type="button"
              title={`Launch ${app.name}`}
              onClick={() => handleLaunch(app)}
              disabled={launching}
              className="group relative flex flex-col items-center justify-center p-3 rounded-xl border border-slate-800/50 bg-navy-950/40 hover:bg-slate-800/50 hover:border-cyan-400/30 disabled:cursor-wait transition-all duration-300"
            >
              {/* Status Indicator */}
              <div
                className={cn(
                  "absolute top-2 right-2 w-1.5 h-1.5 rounded-full transition-colors",
                  launching && "bg-amber-400 animate-pulse",
                  status === "launched" && "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]",
                  status === "error" && "bg-rose-500",
                )}
              />

              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-2 transition-transform duration-300 group-hover:scale-110", app.bg, app.color)}>
                <app.icon size={20} />
              </div>

              <span className="text-[10px] font-mono text-slate-400 group-hover:text-cyan-400 transition-colors uppercase tracking-wider text-center w-full truncate px-1">
                {app.name}
              </span>

              {/* Hover glow */}
              <div className="absolute inset-0 rounded-xl bg-cyan-400/0 group-hover:bg-cyan-400/5 transition-colors pointer-events-none" />
            </button>
          );
        })}
      </div>
    </GlassPanel>
  );
}
