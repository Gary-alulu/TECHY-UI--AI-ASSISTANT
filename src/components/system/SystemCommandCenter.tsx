"use client";

import React from "react";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";
import { GlassPanel } from "../ui/GlassPanel";
import { BlockBar } from "../ui/BlockBar";
import { Thermometer, MemoryStick, Cpu, Database, Monitor, HardDrive, BatteryFull, BatteryWarning } from "lucide-react";
import { cn } from "@/lib/utils";

function formatUptime(seconds?: number): string {
  if (!seconds || seconds < 0) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function barColor(percentage: number): string {
  if (percentage > 85) return "bg-red-400";
  if (percentage > 60) return "bg-amber-400";
  return "bg-cyan-400";
}

interface CommandRowProps {
  label: string;
  percentage: number;
  detail: string;
  icon: React.ReactNode;
  title?: string;
}

function CommandRow({ label, percentage, detail, icon, title }: CommandRowProps) {
  return (
    <div className="flex items-center gap-3" title={title}>
      <div className="w-16 shrink-0 flex items-center gap-1.5">
        <span className="text-cyan-400">{icon}</span>
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        <BlockBar
          percentage={percentage}
          className="h-3"
          filledClassName={barColor(percentage)}
          emptyClassName="bg-slate-800/80"
        />
      </div>
      <div className="w-24 shrink-0 text-right">
        <span className="text-[11px] font-mono text-slate-200">{percentage}%</span>
        <div className="text-[9px] font-mono text-slate-500 truncate">{detail}</div>
      </div>
    </div>
  );
}

function TempCard({ label, value, icon }: { label: string; value: number | null; icon: React.ReactNode }) {
  const available = typeof value === "number" && Number.isFinite(value);
  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-navy-950/40 border border-slate-800/50">
      <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-slate-500">
        {icon}
        {label}
      </div>
      {available ? (
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              "text-xl font-display font-semibold",
              value >= 80 ? "text-red-400" : value >= 65 ? "text-amber-300" : "text-emerald-300"
            )}
          >
            {Math.round(value ?? 0)}°
          </span>
          <span className="text-[9px] font-mono text-slate-500">C</span>
        </div>
      ) : (
        <span className="text-xs font-mono text-slate-600">N/A</span>
      )}
    </div>
  );
}

export function SystemCommandCenter() {
  const { metrics, isLive } = useSystemMetrics();

  const cpuPct = metrics.cpu.percentage ?? 0;
  const ramPct = metrics.ram.percentage ?? 0;
  const gpuPct = metrics.gpu.present as boolean ? metrics.gpu.percentage ?? 0 : 0;
  const storagePct = metrics.storage.percentage ?? 0;

  const gpuPresent = metrics.gpu.present as boolean;
  const vramMB = metrics.gpu.vramMB;
  const vramUsedMB = metrics.gpu.vramUsedMB;
  const gpuVramPct = vramMB && vramUsedMB != null ? Math.round((vramUsedMB / vramMB) * 100) : null;

  const battery = metrics.battery;

  return (
    <GlassPanel
      header="Command Center"
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
      <div className="flex flex-col gap-4 h-full overflow-y-auto">
        {/* Primary status bars */}
        <div className="flex flex-col gap-3">
          <CommandRow
            label="CPU"
            percentage={cpuPct}
            detail={`${metrics.cpu.cores ?? "?"} cores`}
            icon={<Cpu size={12} />}
            title={metrics.cpu.model}
          />
          <CommandRow
            label="RAM"
            percentage={ramPct}
            detail={`${metrics.ram.used == null ? "?" : metrics.ram.used} / ${metrics.ram.total ?? "?"} ${metrics.ram.unit ?? "GB"}`}
            icon={<Database size={12} />}
          />
          <CommandRow
            label="GPU"
            percentage={gpuPct}
            detail={gpuPresent ? metrics.gpu.name ?? "GPU" : "No GPU"}
            icon={<Monitor size={12} />}
            title={metrics.gpu.name}
          />
          <CommandRow
            label="Disk"
            percentage={storagePct}
            detail={`${metrics.storage.used ?? "?"} / ${metrics.storage.total ?? "?"} ${metrics.storage.unit ?? "GB"}`}
            icon={<HardDrive size={12} />}
            title={`Mount: ${metrics.storage.mount ?? ""}`}
          />
          {battery != null && (
            <CommandRow
              label="Batt"
              percentage={battery.percentage}
              detail={battery.charging ? "charging" : "on battery"}
              icon={
                battery.percentage > 50 ? <BatteryFull size={12} /> : <BatteryWarning size={12} className="text-amber-400" />
              }
              title={battery.charging ? "AC power — charging" : "Running on battery"}
            />
          )}
        </div>

        {/* Thermal + VRAM */}
        <div className="grid grid-cols-2 gap-2">
          <TempCard label="CPU Temp" value={metrics.temperatures?.cpu ?? null} icon={<Thermometer size={11} />} />
          <TempCard label="GPU Temp" value={metrics.temperatures?.gpu ?? null} icon={<Thermometer size={11} />} />
        </div>

        <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-navy-950/40 border border-slate-800/50">
          <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-slate-500">
            <MemoryStick size={11} />
            GPU Memory
          </div>
          {gpuVramPct != null ? (
            <div className="flex flex-col gap-1.5">
              <BlockBar
                percentage={gpuVramPct}
                className="h-2.5"
                filledClassName={barColor(gpuVramPct)}
                emptyClassName="bg-slate-800/80"
              />
              <span className="text-[11px] font-mono text-slate-300">
                {vramUsedMB} / {vramMB} MB ({gpuVramPct}%)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-600">
                {vramMB ? `${vramMB} MB VRAM` : "N/A — no NVIDIA tooling detected"}
              </span>
              {vramMB != null && <span className="w-1 h-1 rounded-full bg-emerald-500/70" />}
            </div>
          )}
        </div>

        {/* System identity */}
        <div className="text-[10px] font-mono text-slate-500 leading-relaxed bg-navy-950/40 border border-slate-800/50 rounded-lg px-3 py-2 truncate">
          <div className="text-slate-300 truncate">
            {metrics.machine ? [metrics.machine.manufacturer, metrics.machine.model].filter(Boolean).join(" ") : "Local machine"}
          </div>
          <div className="truncate">{metrics.cpu.model || "Detecting CPU…"}</div>
          <div className="truncate">
            {metrics.machine?.osName} · {metrics.machine?.hostname}
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>Up {formatUptime(metrics.uptime)}</span>
            {battery != null && <span>{battery.percentage}% battery</span>}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}