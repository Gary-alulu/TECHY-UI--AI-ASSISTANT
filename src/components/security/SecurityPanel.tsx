"use client";

import React, { useCallback, useEffect, useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { ShieldCheck, Wifi, WifiOff, FileClock, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SecurityCategory, SecurityLevel, SecurityPolicy } from "@/types";

const LEVELS: SecurityLevel[] = ["allowed", "confirm", "restricted"];

export function SecurityPanel() {
  const [categories, setCategories] = useState<Array<{ key: SecurityCategory; label: string; description: string }>>([]);
  const [policy, setPolicy] = useState<Record<SecurityCategory, SecurityLevel> | null>(null);
  const [localOnly, setLocalOnly] = useState(false);
  const [logActivity, setLogActivity] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/security", { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { policy: SecurityPolicy; categories: Array<{ key: SecurityCategory; label: string; description: string }> };
      setCategories(data.categories);
      setPolicy({
        fileAccess: data.policy.fileAccess,
        appLaunch: data.policy.appLaunch,
        terminal: data.policy.terminal,
        deleteFiles: data.policy.deleteFiles,
        systemSettings: data.policy.systemSettings,
        network: data.policy.network,
      });
      setLocalOnly(data.policy.localOnly);
      setLogActivity(data.policy.logActivity);
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

  const setLevel = async (category: SecurityCategory, level: SecurityLevel) => {
    if (!policy || saving) return;
    setPolicy((current) => (current ? { ...current, [category]: level } : current));
    setSaving(true);
    try {
      await fetch("/api/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [category]: level }),
      });
    } catch {
      await load();
    } finally {
      setSaving(false);
    }
  };

  const setFlag = async (key: "localOnly" | "logActivity", value: boolean) => {
    if (key === "localOnly") setLocalOnly(value);
    else setLogActivity(value);
    try {
      await fetch("/api/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
    } catch {
      await load();
    }
  };

  if (loading || !policy) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-600">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <GlassPanel header={<span className="flex items-center gap-2"><ShieldCheck size={14} className="text-emerald-400" /> Permissions</span>}>
        <div className="space-y-4">
          {categories.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200">{item.label}</p>
                <p className="text-[10px] text-slate-500">{item.description}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {LEVELS.map((level) => {
                  const active = policy[item.key] === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setLevel(item.key, level)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider border transition-colors",
                        active
                          ? level === "restricted"
                            ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
                            : level === "confirm"
                              ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                              : "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                          : "border-slate-800/50 text-slate-600 hover:text-slate-300"
                      )}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] font-mono text-slate-600 mt-4">
          <Lock size={10} className="inline mr-1" /> Plugins are blocked from any permission whose level is below &ldquo;allowed&rdquo;.
        </p>
      </GlassPanel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassPanel className="h-full">
          <div className="flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-lg border flex items-center justify-center", localOnly ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-navy-950 border-slate-700 text-slate-500")}>
              {localOnly ? <WifiOff size={16} /> : <Wifi size={16} />}
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-200">Local-only mode</p>
              <p className="text-[10px] text-slate-500">Forces TECHY fully offline — no model or network calls. Offline skills keep working.</p>
            </div>
            <button
              type="button"
              onClick={() => setFlag("localOnly", !localOnly)}
              className={cn("w-9 h-5 rounded-full border transition-colors relative", localOnly ? "bg-emerald-500/30 border-emerald-500/50" : "bg-navy-950 border-slate-700")}
            >
              <span className={cn("absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all", localOnly ? "left-[18px] bg-emerald-400" : "left-0.5 bg-slate-500")} />
            </button>
          </div>
        </GlassPanel>

        <GlassPanel className="h-full">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-navy-950 border border-slate-700 text-slate-500 flex items-center justify-center">
              <FileClock size={16} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-200">Activity logging</p>
              <p className="text-[10px] text-slate-500">Records every action TECHY takes into the activity log.</p>
            </div>
            <button
              type="button"
              onClick={() => setFlag("logActivity", !logActivity)}
              className={cn("w-9 h-5 rounded-full border transition-colors relative", logActivity ? "bg-cyan-500/30 border-cyan-500/50" : "bg-navy-950 border-slate-700")}
            >
              <span className={cn("absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all", logActivity ? "left-[18px] bg-cyan-400" : "left-0.5 bg-slate-500")} />
            </button>
          </div>
        </GlassPanel>
      </div>

      {saving && (
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-600">
          <Loader2 size={11} className="animate-spin" /> applying…
        </div>
      )}
    </div>
  );
}