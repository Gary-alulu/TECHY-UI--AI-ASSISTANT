"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useBrand } from "@/context/BrandContext";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";
import { BlockBar } from "@/components/ui/BlockBar";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowDownUp,
  Battery,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Cpu,
  Crosshair,
  Gauge,
  HardDrive,
  MemoryStick,
  Thermometer,
  Timer,
} from "lucide-react";

export const HUD_STORAGE_KEY = "techy:hud";

function formatUptime(seconds?: number): string {
  const days = Math.floor(seconds! / 86400);
  const hours = Math.floor((seconds! % 86400) / 3600);
  const minutes = Math.floor((seconds! % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function HudGauge({ value }: { value: number }) {
  return <BlockBar percentage={Math.round(value)} segments={14} filledClassName={value > 85 ? "bg-red-500" : value > 70 ? "bg-amber-500" : "bg-cyan-400"} emptyClassName="bg-slate-800" className="h-1.5 w-full" />;
}

function HudRow({ icon, label, value, children }: { icon: React.ReactNode; label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 w-24 shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children ?? <span className="text-xs font-mono text-slate-200">{value}</span>}</div>
    </div>
  );
}

export function HudOverlay() {
  const { aiState, isLocalAIConnected, activeModel } = useApp();
  const { brand, accent } = useBrand();
  const { metrics } = useSystemMetrics(1500);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem(HUD_STORAGE_KEY);
        if (saved) setOpen(saved === "1");
      } catch {
        // storage may be unavailable
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const toggle = () => setOpen((current) => !current);
    window.addEventListener("techy:hud-token", toggle);
    return () => window.removeEventListener("techy:hud-token", toggle);
  }, []);

  const handleToggle = () => {
    setOpen((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(HUD_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="w-[340px] rounded-xl glass-panel-elevated border border-slate-700/70 p-4 flex flex-col gap-3 hud-corner animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest" style={{ color: accent.hex }}>
              <Crosshair size={11} /> {brand.aiName} HUD
            </div>
            <span className={cn("text-[10px] font-mono uppercase tracking-wider", isLocalAIConnected ? "text-emerald-400" : "text-amber-400")}>
              {isLocalAIConnected ? "core online" : "core offline"}
            </span>
          </div>

          <div className="h-px bg-slate-800" />

          <div className="flex flex-col gap-2.5">
            <HudRow icon={<Cpu size={11} className="text-slate-400" />} label="CPU" value={`${Math.round(metrics.cpu.percentage)}%`}>
              <HudGauge value={metrics.cpu.percentage} />
            </HudRow>
            <HudRow icon={<MemoryStick size={11} className="text-slate-400" />} label="RAM" value={`${Math.round(metrics.ram.percentage)}% · ${metrics.ram.used ?? "?"}${metrics.ram.unit ?? "GB"}`}>
              <HudGauge value={metrics.ram.percentage} />
            </HudRow>
            <HudRow icon={<Gauge size={11} className="text-slate-400" />} label="GPU" value={`${Math.round(metrics.gpu.percentage)}%`}>
              <HudGauge value={metrics.gpu.percentage} />
            </HudRow>
            <HudRow icon={<HardDrive size={11} className="text-slate-400" />} label="Disk" value={`${Math.round(metrics.storage.percentage)}% · ${metrics.storage.used}${metrics.storage.unit ?? "GB"} used`}>
              <HudGauge value={metrics.storage.percentage} />
            </HudRow>
            <HudRow icon={<ArrowDownUp size={11} className="text-slate-400" />} label="Network" value={`↓ ${metrics.network.download.toFixed(1)} · ↑ ${metrics.network.upload.toFixed(1)} ${metrics.network.unit}`} />
            <HudRow icon={<Activity size={11} className="text-slate-400" />} label="AI State" value={aiState.label} />
            <HudRow icon={<BrainCircuit size={11} className="text-slate-400" />} label="Model" value={activeModel?.name ?? "auto"} />
            <HudRow icon={<Thermometer size={11} className="text-slate-400" />} label="CPU Temp" value={metrics.temperatures?.cpu != null ? `${Math.round(metrics.temperatures.cpu)}°C` : "—"} />
            {metrics.battery && (
              <HudRow icon={<Battery size={11} className="text-slate-400" />} label="Battery" value={`${Math.round(metrics.battery.percentage)}%${metrics.battery.charging ? " · charging" : ""}`} />
            )}
            <HudRow icon={<Timer size={11} className="text-slate-400" />} label="Uptime" value={formatUptime(metrics.uptime)} />
          </div>

          <div className="pt-1 text-[9px] font-mono text-slate-600 tracking-wide flex items-center justify-between">
            <span>source: {metrics.source ?? "live"}</span>
            <span>{aiState.state}</span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "w-11 h-11 rounded-full border flex items-center justify-center transition-all glass-panel-elevated",
          open ? "border-cyan-400/40 text-cyan-300" : "border-slate-700 text-slate-400 hover:text-cyan-300 hover:border-slate-500"
        )}
        style={open ? { boxShadow: `0 0 20px ${accent.hex}44` } : undefined}
        title="Toggle TECHY HUD"
      >
        {open ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
      </button>
    </div>
  );
}