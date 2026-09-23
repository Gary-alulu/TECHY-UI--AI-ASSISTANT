"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GlassPanel } from "../ui/GlassPanel";
import { HUDButton } from "../ui/HUDButton";
import { FolderKanban, FileText, File, Paintbrush, CheckSquare, Loader2, ArrowRight } from "lucide-react";
import type { ProjectSummary } from "@/types";

function timeAgo(iso: string | null): string {
  if (!iso) return "No activity";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

export function ProjectsPanel() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { projects: ProjectSummary[] };
      setProjects(data.projects);
    } catch {
      // keep
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(load);
    return () => cancelAnimationFrame(frame);
  }, [load]);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-600">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <GlassPanel header="Workspaces" className="text-center py-12">
        <FolderKanban size={28} className="mx-auto text-slate-700 mb-3" />
        <p className="text-sm text-slate-300">No project workspaces yet.</p>
        <p className="text-[11px] font-mono text-slate-600 mt-1 max-w-md mx-auto">
          Folders in the workspace root or in <span className="text-cyan-500">data/projects/</span> that match project-style names become workspaces.
        </p>
      </GlassPanel>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
      {projects.map((project) => (
        <GlassPanel key={project.slug} className="h-full">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-cyan-950 border border-cyan-400/30 flex items-center justify-center shrink-0">
                <FolderKanban size={16} className="text-cyan-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-100 truncate">{project.name}</h3>
                <p className="text-[10px] font-mono text-slate-500">Activity {timeAgo(project.lastActivity)}</p>
              </div>
            </div>
            <Link href="/files" className="shrink-0">
              <HUDButton variant="outline" size="sm" className="h-7 px-2.5 text-[10px]">
                Open <ArrowRight size={11} />
              </HUDButton>
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat icon={<File size={12} />} label="Files" value={project.files} />
            <Stat icon={<FileText size={12} />} label="Documents" value={project.documents} />
            <Stat icon={<Paintbrush size={12} />} label="Designs" value={project.designs} />
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <Stat icon={<CheckSquare size={12} />} label="Tasks" value={project.tasks} highlight />
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}

function Stat({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={highlight ? "rounded-lg border border-cyan-400/20 bg-cyan-950/20 p-2" : "rounded-lg border border-slate-800/50 bg-navy-950/40 p-2"}>
      <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-1">
        {icon} {label}
      </div>
      <p className="text-base font-mono text-slate-100 leading-none">{value}</p>
    </div>
  );
}