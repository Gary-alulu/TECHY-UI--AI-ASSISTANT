"use client";

import React, { useCallback, useEffect, useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import Link from "next/link";
import { Loader2, ShieldCheck, WifiOff, Wifi, Radio, HardDrive, CloudOff, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBrand } from "@/context/BrandContext";

interface OfflineService {
  id: string;
  name: string;
  kind: "local" | "cloud";
  optional: boolean;
  status: "ready" | "degraded" | "off";
  note: string;
}

interface OfflineStatus {
  runningLocally: boolean;
  offlineFirst: boolean;
  internet: boolean;
  localOnly: boolean;
  model: { available: boolean; name: string | null };
  services: OfflineService[];
}

export function OfflineStatusPanel() {
  const { brand } = useBrand();
  const [status, setStatus] = useState<OfflineStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/offline/status", { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      setStatus((await response.json()) as OfflineStatus);
    } catch {
      // keep previous
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    const interval = setInterval(() => void load(), 30_000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
  }, [load]);

  return (
    <div className="space-y-4">
      {/* Hero status */}
      <GlassPanel hudCorners className={cn(status?.localOnly ? "border-emerald-500/20" : "")}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-xl border flex items-center justify-center relative", status?.localOnly ? "bg-emerald-950/40 border-emerald-400/40 text-emerald-400" : "bg-navy-950 border-slate-700 text-slate-500")}>
              {status?.localOnly ? <WifiOff size={20} /> : <Wifi size={20} />}
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">Running Locally</span>
                {status?.localOnly && (
                  <span className="text-[9px] font-mono uppercase tracking-widest bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded px-1.5 py-0.5">Offline Mode</span>
                )}
              </div>
              <h2 className={cn("text-2xl font-display font-medium tracking-wide", status?.localOnly ? "text-slate-100" : "text-slate-200")}>
                {brand.aiName} never needs the cloud
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                {status?.localOnly
                  ? "You're in strict offline mode. Every core capability below runs on this machine."
                  : status?.internet
                    ? "Internet is reachable — but every core capability below runs on this machine. Cloud services stay optional."
                    : "No internet right now — but every core capability below still runs on this machine."}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-mono text-slate-600">Model</div>
            <div className={cn("font-mono text-sm", status?.model.available ? "text-emerald-400" : "text-amber-400")}>
              {status?.model.available ? status.model.name : "Offline skills"}
            </div>
            {status && !status.model.available && (
              <Link href="/settings" className="text-[10px] text-cyan-400 hover:underline">Configure model →</Link>
            )}
          </div>
        </div>
      </GlassPanel>

      {/* Connectivity grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {loading && !status ? (
          <div className="col-span-full flex items-center justify-center py-10 text-slate-600"><Loader2 size={18} className="animate-spin" /></div>
        ) : (
          status?.services.map((service) => (
            <div key={service.id} className="rounded-lg border border-slate-800/60 bg-navy-950/40 p-3 flex items-start gap-3">
              <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0", service.kind === "local" ? "border-cyan-400/30 text-cyan-400 bg-cyan-950/20" : "border-violet-400/30 text-violet-400 bg-violet-950/20")}>
                {service.kind === "local" ? <HardDrive size={14} /> : <CloudOff size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-200">{service.name}</p>
                  <span className={cn("text-[9px] font-mono uppercase tracking-wider flex items-center gap-1", service.status === "ready" ? "text-emerald-400" : service.status === "degraded" ? "text-amber-400" : "text-slate-500")}>
                    {service.status === "ready" ? <CheckCircle2 size={10} /> : <Radio size={10} />}
                    {service.status === "ready" ? (service.optional ? "optional local" : "local") : service.status === "degraded" ? "degraded" : "off"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">{service.note}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-600">
        <ShieldCheck size={11} className="text-emerald-500" />
        Offline-first by design — core functionality never depends on internet availability.
      </div>
      {status && !status.localOnly && (
        <Link href="/security" className="inline-flex items-center gap-2 text-xs font-mono text-cyan-400 border border-cyan-500/50 rounded-lg px-3 py-2 hover:bg-cyan-950/50 transition-colors">
          Force local-only in Security Center →
        </Link>
      )}
    </div>
  );
}