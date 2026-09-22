"use client";

import React from "react";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";
import { GlassPanel } from "../ui/GlassPanel";
import { CircularGauge } from "../ui/CircularGauge";
import { DataGraph } from "../ui/DataGraph";
import { Cpu, Database, Monitor, HardDrive, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTransferRate } from "@/lib/utils";
import { GpuInfo, GpuType } from "@/types";

function gpuTypeLabel(hasDedicated: boolean | undefined, hasIntegrated: boolean | undefined, present: boolean | undefined, type: GpuType | undefined): string {
  if (!present || type === "none") return "NO GPU";
  if (hasDedicated && hasIntegrated) return "DEDICATED + INTEGRATED";
  if (type === "dedicated") return "DEDICATED";
  if (type === "integrated") return "INTEGRATED";
  if (type === "virtual") return "VIRTUAL";
  return "UNKNOWN";
}

function gpuDetail(gpu: Partial<GpuInfo>): string {
  const parts = [gpu.name, gpu.vendor];
  if (gpu.vramMB) parts.push(`${gpu.vramMB} MB VRAM`);
  return parts.filter(Boolean).join(" — ") || "GPU not detected";
}

function formatUptime(seconds?: number): string {
  if (!seconds || seconds < 0) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function SystemMonitorPanel() {
  const { metrics, isLive } = useSystemMetrics();

  const gpuLabel = gpuTypeLabel(metrics.gpu.hasDedicated, metrics.gpu.hasIntegrated, metrics.gpu.present, metrics.gpu.type);
  const gpuPresent = metrics.gpu.present !== false && metrics.gpu.type !== "none";

  return (
    <GlassPanel
      header="System Monitor"
      className="h-full"
      headerAction={
        <span
          className={cn(
            "flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest",
            isLive ? "text-emerald-400" : "text-amber-400"
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isLive ? "bg-emerald-500" : "bg-amber-400")} />
          {isLive ? "Live" : "Simulated"}
        </span>
      }
    >
      <div className="flex flex-col gap-6 h-full">
        {/* Main Gauges Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div
            className="flex flex-col items-center p-3 rounded-lg bg-navy-950/50 border border-slate-800/50"
            title={metrics.cpu.model ? `CPU: ${metrics.cpu.model} — ${metrics.cpu.cores}c/${metrics.cpu.logical}t @ ${metrics.cpu.speedMHz} MHz` : undefined}
          >
            <CircularGauge
              percentage={metrics.cpu.percentage}
              label="CPU"
              icon={<Cpu size={14} />}
              color={metrics.cpu.percentage > 85 ? "text-red-500" : "text-cyan-400"}
              size={90}
              strokeWidth={6}
            />
            <div className="text-[9px] text-slate-500 mt-1 font-mono tracking-wider">
              {metrics.cpu.percentage > 85 ? "HIGH" : metrics.cpu.percentage > 60 ? "BUSY" : "NORMAL"}
            </div>
          </div>

          <div
            className="flex flex-col items-center p-3 rounded-lg bg-navy-950/50 border border-slate-800/50"
            title={`RAM: ${metrics.ram.total || "?"} ${metrics.ram.unit} total`}
          >
            <CircularGauge
              percentage={metrics.ram.percentage}
              label="RAM"
              icon={<Database size={14} />}
              color={metrics.ram.percentage > 90 ? "text-red-500" : "text-violet-400"}
              size={90}
              strokeWidth={6}
            />
            <div className="text-[9px] text-slate-500 mt-1 font-mono tracking-wider">
              {metrics.ram.used?.toFixed(1)} / {metrics.ram.total} {metrics.ram.unit}
            </div>
          </div>

          <div
            className="flex flex-col items-center p-3 rounded-lg bg-navy-950/50 border border-slate-800/50"
            title={gpuPresent ? gpuDetail(metrics.gpu) : undefined}
          >
            <CircularGauge
              percentage={gpuPresent ? metrics.gpu.percentage : 0}
              label="GPU"
              icon={<Monitor size={14} />}
              color={gpuPresent ? "text-emerald-400" : "text-slate-700"}
              size={90}
              strokeWidth={6}
            />
            <div className={cn("text-[9px] mt-1 font-mono tracking-wider", gpuPresent ? "text-slate-500" : "text-slate-600")}>
              {gpuLabel}
            </div>
          </div>

          <div
            className="flex flex-col items-center p-3 rounded-lg bg-navy-950/50 border border-slate-800/50"
            title={`Storage: ${metrics.storage.mount || ""} (${metrics.storage.total} ${metrics.storage.unit} total)`}
          >
            <CircularGauge
              percentage={metrics.storage.percentage}
              label="Storage"
              icon={<HardDrive size={14} />}
              color="text-amber-400"
              size={90}
              strokeWidth={6}
            />
            <div className="text-[9px] text-slate-500 mt-1 font-mono tracking-wider">
              {metrics.storage.used} / {metrics.storage.total} {metrics.storage.unit}
            </div>
          </div>
        </div>

        {/* Hardware Info */}
        <div className="text-[10px] font-mono text-slate-500 leading-relaxed bg-navy-950/40 border border-slate-800/50 rounded-lg px-3 py-2 truncate">
          <div className="text-slate-300 truncate">
            {metrics.machine ? [metrics.machine.manufacturer, metrics.machine.model].filter(Boolean).join(" ") : "Local machine"}
          </div>
          <div className="truncate">{metrics.cpu.model || "Detecting CPU…"}</div>
          <div className="truncate">
            {metrics.machine?.osName} · {metrics.machine?.hostname}
          </div>
        </div>

        {/* Live Graph */}
        <div className="mt-auto">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">CPU / RAM History</span>
            <span className="text-[9px] text-slate-600 font-mono uppercase tracking-wider">Up {formatUptime(metrics.uptime)}</span>
          </div>
          <div className="relative h-20 rounded-md overflow-hidden bg-navy-950/50 border border-slate-800/50 p-1">
            <div className="absolute inset-1 pointer-events-none">
              <DataGraph data={metrics.cpu.history} color="text-cyan-400" fillColor="text-cyan-900/30" />
            </div>
            <div className="absolute inset-1 pointer-events-none opacity-60">
              <DataGraph data={metrics.ram.history} color="text-violet-400" fillColor="transparent" />
            </div>
          </div>
        </div>

        {/* Network Live Speeds */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="flex items-center gap-2 p-2 rounded bg-navy-950/30 border border-slate-800/30">
            <ArrowUpRight size={14} className="text-cyan-400 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest">Upload Speed</span>
              <span className="text-xs font-mono text-slate-300 truncate">{formatTransferRate(metrics.network.upload)}</span>
            </div>
            {isLive && <span className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse ml-auto" />}
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-navy-950/30 border border-slate-800/30">
            <ArrowDownRight size={14} className="text-violet-400 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest">Download Speed</span>
              <span className="text-xs font-mono text-slate-300 truncate">{formatTransferRate(metrics.network.download)}</span>
            </div>
            {isLive && <span className="w-1 h-1 rounded-full bg-violet-400 animate-pulse ml-auto" />}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}