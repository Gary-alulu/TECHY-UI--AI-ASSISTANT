"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useBrand } from "@/context/BrandContext";
import { HUDButton } from "@/components/ui/HUDButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Activity, ArrowDownUp, Loader2, Network, RefreshCw, Wifi } from "lucide-react";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";
import type { AdapterStatus, NetworkIntelligence, NetworkNeighbor } from "@/types";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = { wifi: "Wi-Fi", ethernet: "Ethernet", bluetooth: "Bluetooth", virtual: "Virtual", other: "Other" };

export function NetworkIntelPanel() {
  const { accent } = useBrand();
  const { metrics } = useSystemMetrics(2000);
  const [intel, setIntel] = useState<NetworkIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async (auto = false) => {
    if (auto) {
      setLoading(false);
    } else {
      setRunning(true);
    }
    try {
      const response = await fetch("/api/network", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { network: NetworkIntelligence };
        setIntel(data.network);
      }
    } catch {
      // transient — keep last snapshot
    } finally {
      setLoading(false);
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void refresh());
    timerRef.current = setInterval(() => void refresh(true), 15000);
    return () => {
      cancelAnimationFrame(frame);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refresh]);

  const latencyPingClass = intel?.latencyMs == null
    ? "text-slate-500"
    : intel.latencyMs < 30 ? "text-emerald-400" : intel.latencyMs < 80 ? "text-amber-400" : "text-red-400";

  return (
    <div className="flex flex-col gap-5">
      {/* Metrics row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassPanel className="p-4 flex flex-col gap-2 border-slate-800">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500">
            <span>Download</span>
            <ArrowDownUp size={11} className="text-cyan-400" />
          </div>
          <span className="text-xl font-semibold text-slate-100 text-metric">{metrics.network.download.toFixed(1)}</span>
          <span className="text-[11px] font-mono text-slate-500">{metrics.network.unit} live</span>
        </GlassPanel>
        <GlassPanel className="p-4 flex flex-col gap-2 border-slate-800">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500">
            <span>Upload</span>
            <ArrowDownUp size={11} className="text-emerald-400" />
          </div>
          <span className="text-xl font-semibold text-slate-100 text-metric">{metrics.network.upload.toFixed(1)}</span>
          <span className="text-[11px] font-mono text-slate-500">{metrics.network.unit} live</span>
        </GlassPanel>
        <GlassPanel className="p-4 flex flex-col gap-2 border-slate-800">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500">
            <span>LAN latency</span>
            <Activity size={11} className={latencyPingClass} />
          </div>
          <span className={cn("text-xl font-semibold text-metric", latencyPingClass)}>
            {intel ? intel.latencyMs ?? "—" : <Loader2 size={18} className="animate-spin inline" />}
          </span>
          <span className="text-[11px] font-mono text-slate-500 truncate">probe {intel?.probeTarget || "gateway"}</span>
        </GlassPanel>
        <GlassPanel className="p-4 flex flex-col gap-2 border-slate-800">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500">
            <span>Adapt</span>
            <Wifi size={11} style={{ color: accent.hex }} />
          </div>
          <span className="text-xl font-semibold text-slate-100 text-metric">
            {intel ? intel.adapters.filter((adapter) => adapter.connected).length : "—"}
          </span>
          <span className="text-[11px] font-mono text-slate-500">connected of {intel?.adapters.length ?? "—"}</span>
        </GlassPanel>
      </div>

      <GlassPanel className="p-4 flex items-center justify-between gap-3 border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Network size={14} className="text-cyan-400" />
          {intel ? (
            <span className="flex gap-2 flex-wrap">
              <span>{intel.interfaces.length} interface{intel.interfaces.length === 1 ? "" : "s"} reporting</span>
              <span className="text-slate-600">·</span>
              <span>{intel.neighbors.length} devices on your LAN</span>
              <span className="text-slate-600">·</span>
              <span className="font-mono text-[10px]">probed {new Date(intel.measuredAt).toLocaleTimeString()}</span>
            </span>
          ) : (
            <span>{loading ? "Probing your network…" : "No data"}</span>
          )}
        </div>
        <HUDButton variant="outline" size="sm" className="text-slate-400" onClick={() => void refresh()} disabled={running}>
          {running ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <RefreshCw size={12} className="mr-1.5" />}
          Rescan
        </HUDButton>
      </GlassPanel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Adapters */}
        <GlassPanel header="Network Adapters" className="p-5 gap-3 border-slate-800" hudCorners>
          <div className="flex flex-col gap-2.5">
            {(intel?.adapters ?? []).map((adapter: AdapterStatus) => (
              <div key={`${adapter.name}-${adapter.mac ?? ""}`} className="flex items-center gap-3 rounded-lg bg-navy-950/50 border border-slate-800/70 px-3 py-2.5">
                <span className={cn("w-2 h-2 rounded-full shrink-0", adapter.connected ? "bg-emerald-400 animate-pulse" : "bg-slate-700")} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">{adapter.name}</div>
                  <div className="text-[10px] font-mono text-slate-500 flex items-center gap-2">
                    <span className="uppercase tracking-wider">{KIND_LABEL[adapter.kind] ?? adapter.kind}</span>
                    {adapter.linkSpeedMbps && <><span>·</span><span>{adapter.linkSpeedMbps} Mbps</span></>}
                    {adapter.mac && <><span>·</span><span className="truncate">{adapter.mac}</span></>}
                  </div>
                </div>
                <span className={cn("text-[10px] font-mono uppercase tracking-wider", adapter.connected ? "text-emerald-400" : "text-slate-600")}>
                  {adapter.connected ? "Up" : "Down"}
                </span>
              </div>
            ))}
            {intel && intel.adapters.length === 0 && <p className="text-xs text-slate-500">No adapters could be enumerated.</p>}
          </div>
        </GlassPanel>

        {/* Neighbors */}
        <GlassPanel header={`LAN Neighbors · ${intel?.neighbors.length ?? 0}`} className="p-5 gap-3 border-slate-800" hudCorners>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
            {(intel?.neighbors ?? []).map((neighbor: NetworkNeighbor, index) => (
              <div key={index} className="flex items-center gap-3 rounded-lg bg-navy-950/50 border border-slate-800/70 px-3 py-2">
                <span className="font-mono text-xs text-slate-200 flex-1 min-w-0">{neighbor.ip}</span>
                {neighbor.mac && <span className="font-mono text-[10px] text-slate-500 truncate hidden sm:inline">{neighbor.mac}</span>}
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-600">{neighbor.state}</span>
              </div>
            ))}
            {intel && intel.neighbors.length === 0 && (
              <p className="text-xs text-slate-500">Nothing reachable on this subnet right now.</p>
            )}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}