"use client";

import React, { useEffect, useRef, useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { DataGraph } from "../ui/DataGraph";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes, formatTransferRate } from "@/lib/utils";
import type { NetworkInterfaceInfo, NetworkMetric } from "@/types";

const HISTORY = 30;

function sumBytes(interfaces: NetworkInterfaceInfo[], key: "rxBytes" | "txBytes"): number {
  return interfaces.reduce((total, iface) => total + iface[key], 0);
}

export function NetworkTrafficPanel() {
  const [totals, setTotals] = useState<NetworkMetric>({ upload: 0, download: 0, unit: "MB/s" });
  const [interfaces, setInterfaces] = useState<NetworkInterfaceInfo[]>([]);
  const [downHistory, setDownHistory] = useState<number[]>(Array(HISTORY).fill(0));
  const [upHistory, setUpHistory] = useState<number[]>(Array(HISTORY).fill(0));
  const [session, setSession] = useState<{ downBytes: number; upBytes: number }>({ downBytes: 0, upBytes: 0 });
  const lastBytes = useRef<{ rx: number; tx: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch("/api/system/metrics", { cache: "no-store" });
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        const data = (await response.json()) as {
          network: NetworkMetric;
          interfaces: NetworkInterfaceInfo[];
        };
        if (cancelled) return;

        setTotals(data.network);
        setInterfaces(data.interfaces ?? []);
        setDownHistory((history) => [...history.slice(1), data.network.download]);
        setUpHistory((history) => [...history.slice(1), data.network.upload]);

        // Accumulate session totals from per-interface byte counters.
        const current = {
          rx: sumBytes(data.interfaces ?? [], "rxBytes"),
          tx: sumBytes(data.interfaces ?? [], "txBytes"),
        };
        if (lastBytes.current) {
          setSession((previous) => ({
            downBytes: previous.downBytes + Math.max(0, current.rx - lastBytes.current!.rx),
            upBytes: previous.upBytes + Math.max(0, current.tx - lastBytes.current!.tx),
          }));
        }
        lastBytes.current = current;
      } catch {
        // Keep the last known values; the panel shows them until the next poll.
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const maxRate = Math.max(1, ...downHistory, ...upHistory);

  return (
    <GlassPanel
      header="Network Traffic"
      className="h-[250px] shrink-0"
      headerAction={
        <span className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      }
    >
      <div className="flex flex-col h-full min-h-0 gap-2">
        {/* Live Download / Upload Speeds */}
        <div className="grid grid-cols-2 gap-2 shrink-0">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-navy-950/50 border border-slate-800/50">
            <ArrowDownRight size={14} className="text-violet-400 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest">Download Speed</span>
              <span className="text-sm font-mono text-slate-200 truncate">{formatTransferRate(totals.download)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-navy-950/50 border border-slate-800/50">
            <ArrowUpRight size={14} className="text-cyan-400 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest">Upload Speed</span>
              <span className="text-sm font-mono text-slate-200 truncate">{formatTransferRate(totals.upload)}</span>
            </div>
          </div>
        </div>

        {/* Throughput Graph */}
        <div className="relative h-14 rounded-md overflow-hidden bg-navy-950/40 border border-slate-800/50 shrink-0">
          <div className="absolute inset-1 pointer-events-none">
            <DataGraph data={downHistory} color="text-violet-400" fillColor="text-violet-900/25" min={0} max={maxRate} height={48} />
          </div>
          <div className="absolute inset-1 pointer-events-none opacity-70">
            <DataGraph data={upHistory} color="text-cyan-400" fillColor="transparent" min={0} max={maxRate} height={48} />
          </div>
        </div>

        {/* Per-interface stats + session totals */}
        <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-slate-800/50 bg-navy-950/40">
          {interfaces.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-600 font-mono text-[10px]">
              No active adapters
            </div>
          ) : (
            <div className="divide-y divide-slate-800/40">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-2.5 py-1.5 bg-slate-800/20 text-slate-400">
                <span className="text-[9px] uppercase tracking-widest">Interfaces</span>
                <span className="text-[9px] uppercase tracking-widest">Rx/s</span>
                <span className="text-[9px] uppercase tracking-widest">Tx/s</span>
              </div>
              {interfaces.map((iface) => (
                <div key={iface.name} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-2.5 py-1">
                  <span className="text-[11px] font-mono text-slate-300 truncate">{iface.name}</span>
                  <span
                    className={cn(
                      "text-[10px] font-mono",
                      iface.rxRateMBps > 0 ? "text-violet-400" : "text-slate-600"
                    )}
                    title={`Total received: ${formatBytes(iface.rxBytes)}`}
                  >
                    {formatTransferRate(iface.rxRateMBps)}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-mono",
                      iface.txRateMBps > 0 ? "text-cyan-400" : "text-slate-600"
                    )}
                    title={`Total sent: ${formatBytes(iface.txBytes)}`}
                  >
                    {formatTransferRate(iface.txRateMBps)}
                  </span>
                </div>
              ))}
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-2.5 py-1.5">
                <span className="text-[9px] uppercase tracking-widest text-slate-500">Session total</span>
                <span className="text-[10px] font-mono text-violet-300" title="Total downloaded this session">
                  {formatBytes(session.downBytes)}
                </span>
                <span className="text-[10px] font-mono text-cyan-300" title="Total uploaded this session">
                  {formatBytes(session.upBytes)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}