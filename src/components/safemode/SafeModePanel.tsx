"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/context/BrandContext";
import { HUDButton } from "@/components/ui/HUDButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { AlertTriangle, Loader2, Lock, ShieldAlert, ShieldCheck, Unlock } from "lucide-react";
import type { SafeModeCapability, SafeModeState } from "@/types";
import { cn } from "@/lib/utils";

const CAPABILITIES: Array<{ key: SafeModeCapability; label: string; description: string; danger: boolean }> = [
  { key: "chat", label: "AI Chat", description: "Plain conversation stays on.", danger: false },
  { key: "fileRead", label: "File Reading", description: "Reading and preparing files stays on.", danger: false },
  { key: "systemMonitor", label: "System Monitoring", description: "Reporting CPU, RAM and disks stays on.", danger: false },
  { key: "fileModify", label: "File Modification", description: "Renaming, moving or deleting files.", danger: true },
  { key: "appControl", label: "App Control", description: "Launching or closing applications.", danger: true },
  { key: "terminal", label: "Terminal", description: "Running commands and scripts.", danger: true },
  { key: "automation", label: "Automation", description: "Executing saved workflows.", danger: true },
];

export function SafeModePanel() {
  const { accent } = useBrand();
  const [state, setState] = useState<SafeModeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/safemode", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { state: SafeModeState };
        setState(data.state);
      }
    } catch {
      // keep last snapshot
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const toggle = useCallback(async () => {
    if (!state) return;
    setBusy(true);
    try {
      const response = await fetch("/api/safemode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", active: !state.active }),
      });
      if (response.ok) {
        const data = (await response.json()) as { state: SafeModeState };
        setState(data.state);
      }
    } finally {
      setBusy(false);
    }
  }, [state]);

  const setCapability = useCallback(async (capability: SafeModeCapability, allowed: boolean) => {
    const response = await fetch("/api/safemode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "capability", capability, allowed }),
    });
    if (response.ok) {
      const data = (await response.json()) as { state: SafeModeState };
      setState(data.state);
    }
  }, []);

  if (loading && !state) {
    return (
      <GlassPanel className="p-8 flex items-center justify-center text-slate-500">
        <Loader2 size={20} className="animate-spin text-cyan-400 mr-3" />
        <span className="font-mono text-xs">Loading safe mode…</span>
      </GlassPanel>
    );
  }

  if (!state) return null;

  const disabledCount = Object.values(state.capabilities).filter((allowed) => !allowed).length;

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      {/* Master toggle */}
      <GlassPanel
        className={cn("p-8 flex flex-col items-center gap-5 text-center border", state.active ? "border-red-500/30" : "border-slate-800")}
        hudCorners
      >
        <div
          className={cn("w-16 h-16 rounded-2xl border flex items-center justify-center", state.active ? "border-red-500/40 bg-red-950/30 text-red-400" : "border-emerald-400/30 bg-emerald-950/20 text-emerald-400")}
          style={state.active ? { boxShadow: "0 0 30px rgba(239,68,68,0.25)" } : undefined}
        >
          {state.active ? <ShieldAlert size={30} /> : <ShieldCheck size={30} />}
        </div>

        <div>
          <h3 className="font-display font-medium text-slate-100 text-xl tracking-wide">
            {state.active ? "Safe Mode is ON" : "Safe Mode is OFF"}
          </h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md">
            {state.active
              ? `${disabledCount} of 7 dangerous capabilities are locked. TECHY can still chat, read files and watch the system — it just cannot touch your machine.`
              : "Switch it on to stop TECHY from modifying files, opening apps, running commands or firing automations."}
          </p>
          {state.enabledAt && state.active && (
            <p className="text-[11px] font-mono text-slate-500 mt-1.5">enabled {new Date(state.enabledAt).toLocaleString()}</p>
          )}
        </div>

        <HUDButton
          variant={state.active ? "default" : "outline"}
          size="lg"
          className={state.active ? "bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30" : "text-emerald-300 border-emerald-400/30"}
          onClick={() => void toggle()}
          disabled={busy}
        >
          {busy ? <Loader2 size={15} className="animate-spin mr-2" /> : state.active ? <Unlock size={15} className="mr-2" /> : <Lock size={15} className="mr-2" />}
          {state.active ? "Exit safe mode" : "Enable safe mode"}
        </HUDButton>
      </GlassPanel>

      {/* Capability matrix */}
      <GlassPanel header="Capability Lockdown" className="p-5 gap-3 border-slate-800" hudCorners>
        <div className="flex flex-col gap-2.5">
          {CAPABILITIES.map((capability) => {
            const allowed = state.capabilities[capability.key];
            return (
              <div key={capability.key} className="flex items-center gap-4 rounded-lg bg-navy-950/50 border border-slate-800/70 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-200">{capability.label}</span>
                    {capability.danger && (
                      <span className="px-1.5 py-0.5 rounded font-mono text-[9px] uppercase tracking-wider text-amber-300 border border-amber-400/30 bg-amber-950/20">high risk</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{capability.description}</p>
                </div>
                <span
                  className={cn(
                    "px-2 py-1 rounded-md font-mono text-[10px] uppercase tracking-wider border shrink-0",
                    allowed ? "text-emerald-300 border-emerald-400/30 bg-emerald-950/20" : "text-slate-400 border-slate-700 bg-slate-800/40"
                  )}
                >
                  {state.active ? (allowed ? "Allowed" : "Locked") : "On"}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={allowed}
                  onClick={() => void setCapability(capability.key, !allowed)}
                  className={cn(
                    "relative w-10 h-5 rounded-full transition-colors shrink-0",
                    allowed ? "bg-emerald-500/70" : "bg-slate-700"
                  )}
                  style={allowed ? { backgroundColor: accent.hex } : undefined}
                >
                  <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", allowed ? "left-[22px]" : "left-0.5")} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-400/15 bg-amber-950/10 text-[11px] text-slate-400 leading-relaxed">
          <AlertTriangle size={12} className="shrink-0 mt-0.5 text-amber-400" />
          <span>Safe mode is enforced by TECHY&apos;s tool layer: even if you turn a capability back on here, chat commands that would use it must pass this check first.</span>
        </div>
      </GlassPanel>
    </div>
  );
}