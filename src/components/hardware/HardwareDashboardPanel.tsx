"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/context/BrandContext";
import { HUDButton } from "@/components/ui/HUDButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { BlockBar } from "@/components/ui/BlockBar";
import {
  Boxes,
  Cpu,
  Database,
  Fan,
  HardDrive,
  Loader2,
  MemoryStick,
  MonitorSmartphone,
  RefreshCw,
} from "lucide-react";
import type { HardwareDashboard } from "@/types";
import { cn } from "@/lib/utils";

function pctColor(value: number): string {
  return value > 85 ? "bg-red-500" : value > 70 ? "bg-amber-500" : "bg-cyan-400";
}

export function HardwareDashboardPanel() {
  const { accent } = useBrand();
  const [dashboard, setDashboard] = useState<HardwareDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    try {
      const response = await fetch(force ? "/api/hardware?refresh=1" : "/api/hardware", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { dashboard: HardwareDashboard };
        setDashboard(data.dashboard);
      }
    } catch {
      // keep last snapshot
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const d = dashboard;

  return (
    <div className="flex flex-col gap-5">
      <GlassPanel className="p-4 flex items-center justify-between gap-3 border-slate-800">
        <div className="flex items-center gap-3">
          <Boxes size={16} className="text-cyan-400" />
          <span className="text-xs text-slate-400">
            {d ? (
              <span className="flex gap-2 flex-wrap font-mono text-[11px]">
                <span className="text-slate-200">{d.cpu.model ?? "Unknown CPU"}</span>
                {d.cpu.cores && <span>· {d.cpu.cores} cores</span>}
                {d.machine?.hostname && <span>· {d.machine.hostname}</span>}
                <span className="text-slate-600">· probed {new Date(d.detectedAt).toLocaleTimeString()}</span>
              </span>
            ) : (
              <span>{loading ? "Reading hardware…" : "No data"}</span>
            )}
          </span>
        </div>
        <HUDButton variant="outline" size="sm" className="text-slate-400" onClick={() => void load(true)} disabled={refreshing}>
          {refreshing ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <RefreshCw size={12} className="mr-1.5" />}
          Refresh
        </HUDButton>
      </GlassPanel>

      {loading && !d && (
        <GlassPanel className="p-8 flex items-center justify-center text-slate-500">
          <Loader2 size={20} className="animate-spin text-cyan-400 mr-3" />
          <span className="font-mono text-xs">Probing motherboard, fans and peripherals…</span>
        </GlassPanel>
      )}

      {d && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard icon={<Cpu size={14} />} label="CPU" value="--" display={`${d.cpu.cores ?? "?"} cores${d.cpu.speedMHz ? ` · ${Math.round(d.cpu.speedMHz)} MHz` : ""}`} bar={0} accent={accent.hex} />
            <MetricCard icon={<MemoryStick size={14} />} label="RAM" value={`${Math.round(d.ram.percentage)}`} display={`${d.ram.usedGB.toFixed(1)} / ${d.ram.totalGB.toFixed(1)} GB`} bar={d.ram.percentage} accent={accent.hex} />
            <MetricCard icon={<Database size={14} />} label="Storage" value={`${Math.round(d.storage.percentage)}`} display={`${d.storage.usedGB} / ${d.storage.totalGB} GB`} bar={d.storage.percentage} accent={accent.hex} />
            <MetricCard icon={<MonitorSmartphone size={14} />} label="GPU" value="--" display={d.gpu.present ? d.gpu.name.slice(0, 24) : "None detected"} bar={d.gpu.present ? 20 : 0} accent={accent.hex} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <GlassPanel header="Motherboard" className="p-5 gap-3 border-slate-800" hudCorners>
              <SpecRow label="Board" value={[d.motherboard.manufacturer, d.motherboard.product].filter(Boolean).join(" ") || "—"} />
              <SpecRow label="Serial" value={d.motherboard.serial ?? "—"} />
              <SpecRow label="BIOS" value={d.motherboard.biosVersion ?? "—"} />
              <SpecRow label="BIOS vendor" value={d.motherboard.biosVendor ?? "—"} />
            </GlassPanel>

            <GlassPanel header="Thermals & Power" className="p-5 gap-3 border-slate-800" hudCorners>
              <SpecRow label="CPU temp" value={d.temperatures?.cpu != null ? `${Math.round(d.temperatures.cpu)}°C` : "—"} />
              <SpecRow label="GPU temp" value={d.temperatures?.gpu != null ? `${Math.round(d.temperatures.gpu)}°C` : "—"} />
              {d.battery ? (
                <SpecRow label="Battery" value={`${Math.round(d.battery.percentage)}% ${d.battery.charging ? "· charging" : ""}`} />
              ) : (
                <SpecRow label="Battery" value="No battery (desktop)" />
              )}
              <div className="flex items-center gap-2 text-slate-400 mt-2">
                <Fan size={13} className="text-cyan-400" />
                <span className="text-xs">{d.fans.length > 0 ? `${d.fans.length} fan${d.fans.length === 1 ? "" : "s"}` : "No fan sensors exposed"}</span>
              </div>
            </GlassPanel>

            <GlassPanel header={`Displays · ${d.displays.length}`} className="p-5 gap-3 border-slate-800" hudCorners>
              <div className="flex flex-col gap-2.5">
                {d.displays.map((display) => (
                  <div key={display.id} className="rounded-lg bg-navy-950/50 border border-slate-800/70 px-3 py-2.5 flex items-center gap-3">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", display.online ? "bg-emerald-400" : "bg-slate-700")} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-200 truncate">{display.label ?? display.name}</div>
                      <div className="text-[10px] font-mono text-slate-500">{display.resolution ?? display.name}</div>
                    </div>
                    {display.primary && <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">Primary</span>}
                  </div>
                ))}
                {d.displays.length === 0 && <p className="text-xs text-slate-500">No displays enumerated.</p>}
              </div>
            </GlassPanel>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, display, bar, accent }: { icon: React.ReactNode; label: string; value: string; display: string; bar: number; accent: string }) {
  return (
    <GlassPanel className="p-4 flex flex-col gap-2.5 border-slate-800">
      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500">
        <span className="flex items-center gap-1.5">{icon}{label}</span>
        <HardDrive size={10} className="opacity-0" />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-semibold text-slate-100 text-metric" style={bar > 0 ? { color: accent } : undefined}>{value}</span>
        {value !== "--" && <span className="text-xs text-slate-500">%</span>}
      </div>
      <span className="text-[11px] font-mono text-slate-500 truncate" title={display}>{display}</span>
      <BlockBar percentage={bar} segments={12} filledClassName={pctColor(bar)} emptyClassName="bg-slate-800" className="h-1.5" />
    </GlassPanel>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-navy-950/50 border border-slate-800/70 px-3 py-2">
      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 shrink-0">{label}</span>
      <span className="text-xs text-slate-200 truncate text-right">{value}</span>
    </div>
  );
}