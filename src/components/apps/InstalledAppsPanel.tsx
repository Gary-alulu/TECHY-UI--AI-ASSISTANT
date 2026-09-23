"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { Search, RefreshCw, Rocket, Check, AlertTriangle, Package, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_CATEGORIES } from "@/lib/system/appCategories";
import type { AppCategory, InstalledApp } from "@/types";

type LaunchStatus = "idle" | "launching" | "launched" | "error";

const AVATAR_STYLES = [
  "from-cyan-500/30 to-blue-500/10 text-cyan-300",
  "from-violet-500/30 to-fuchsia-500/10 text-violet-300",
  "from-emerald-500/30 to-teal-500/10 text-emerald-300",
  "from-amber-500/30 to-orange-500/10 text-amber-300",
  "from-rose-500/30 to-pink-500/10 text-rose-300",
  "from-sky-500/30 to-indigo-500/10 text-sky-300",
];

function avatarFor(name: string): string {
  const sum = Array.from(name).reduce((total, char) => total + char.charCodeAt(0), 0);
  return AVATAR_STYLES[sum % AVATAR_STYLES.length];
}

export function InstalledAppsPanel() {
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<AppCategory | "all">("all");
  const [statuses, setStatuses] = useState<Record<string, LaunchStatus>>({});
  const [launchError, setLaunchError] = useState<string | null>(null);
  const resetTimers = useRef<Map<string, number>>(new Map());

  const load = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const response = await fetch(`/api/apps/installed${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { apps: InstalledApp[]; error?: string };
      if (data.error) throw new Error(data.error);
      setApps(data.apps ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load installed apps");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      load();
    });
    const timers = resetTimers.current;
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return apps.filter((app) => {
      if (category !== "all" && app.category !== category) return false;
      if (!needle) return true;
      return app.name.toLowerCase().includes(needle) || app.publisher?.toLowerCase().includes(needle);
    });
  }, [apps, query, category]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<AppCategory, number>();
    for (const app of apps) {
      const key = app.category ?? "other";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [apps]);

  const setStatus = (id: string, status: LaunchStatus) =>
    setStatuses((previous) => ({ ...previous, [id]: status }));

  const resetStatusAfter = (id: string, status: LaunchStatus, delay: number) => {
    const existing = resetTimers.current.get(id);
    if (existing) window.clearTimeout(existing);
    const timer = window.setTimeout(() => setStatus(id, status), delay);
    resetTimers.current.set(id, timer);
  };

  const handleLaunch = async (id: string) => {
    if (statuses[id] === "launching") return;
    setLaunchError(null);
    setStatus(id, "launching");

    try {
      const response = await fetch("/api/apps/installed/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!data?.ok) throw new Error(data?.error ?? "Launch failed");

      setStatus(id, "launched");
      resetStatusAfter(id, "idle", 2500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Launch failed";
      setStatus(id, "error");
      setLaunchError(message);
      resetStatusAfter(id, "idle", 3500);
    }
  };

  return (
    <GlassPanel
      header="Installed Applications"
      className="h-full min-h-0"
      headerAction={
        <span className="flex items-center gap-2">
          <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
            {apps.length} installed
          </span>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            title="Re-scan installed apps"
            className="p-1 rounded-md text-slate-400 hover:text-cyan-400 hover:bg-slate-800/60 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={cn(refreshing && "animate-spin")} />
          </button>
        </span>
      }
    >
      <div className="flex flex-col h-full min-h-0 gap-3">
        {/* Toolbar */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center flex-1 gap-2 px-2.5 py-1.5 rounded-lg bg-navy-950/50 border border-slate-800/50 focus-within:border-cyan-400/40 transition-colors">
            <Search size={13} className="text-slate-500 shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search installed apps…"
              className="bg-transparent text-xs font-mono text-slate-200 placeholder:text-slate-600 outline-none w-full py-0.5"
            />
          </div>
          <span className="text-[9px] font-mono uppercase tracking-widest text-slate-600 shrink-0">
            {filtered.length} shown
          </span>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={cn(
              "px-2 py-1 rounded-md text-[9px] font-mono uppercase tracking-wider border transition-colors",
              category === "all"
                ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                : "border-slate-800/50 bg-navy-950/40 text-slate-500 hover:text-slate-300 hover:border-slate-700/60"
            )}
          >
            All {apps.length}
          </button>
          {APP_CATEGORIES.map((item) => {
            const count = categoryCounts.get(item.id) ?? 0;
            const active = category === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(active ? "all" : item.id)}
                title={`${count} installed`}
                className={cn(
                  "px-2 py-1 rounded-md text-[9px] font-mono uppercase tracking-wider border transition-colors",
                  active
                    ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                    : "border-slate-800/50 bg-navy-950/40 text-slate-500 hover:text-slate-300 hover:border-slate-700/60"
                )}
              >
                {item.label}{count > 0 ? ` ${count}` : ""}
              </button>
            );
          })}
          {category !== "all" && (
            <button
              type="button"
              onClick={() => setCategory("all")}
              className="px-1.5 py-1 rounded-md text-[9px] font-mono text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
              title="Clear category filter"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {launchError && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[10px] font-mono text-rose-400 shrink-0">
            <AlertTriangle size={12} className="shrink-0" />
            <span className="truncate">{launchError}</span>
          </div>
        )}

        {/* App Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-20 rounded-lg bg-slate-800/30 border border-slate-800/50 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500">
              <AlertTriangle size={20} />
              <span className="text-xs font-mono">{error}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600">
              <Package size={22} />
              <span className="text-xs font-mono">{query ? "No apps match your search" : "No installed apps found"}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((app) => {
                const status = statuses[app.id] ?? "idle";
                return (
                  <div
                    key={app.id}
                    className="group flex items-start gap-3 p-3 rounded-lg border border-slate-800/50 bg-navy-950/40 hover:border-cyan-400/30 hover:bg-slate-800/40 transition-all duration-300"
                  >
                    <div
                      className={cn(
                        "w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center text-sm font-display font-semibold shrink-0",
                        avatarFor(app.name)
                      )}
                    >
                      {app.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-200 truncate" title={app.name}>
                        {app.name}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 truncate">
                        <span className="text-[9px] font-mono uppercase tracking-widest text-cyan-500/60 border border-cyan-500/20 rounded px-1 py-px bg-navy-950/40">
                          {app.category ?? "other"}
                        </span>
                        {app.publisher || "Unknown publisher"}
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-600 mt-0.5">
                        {app.version && <span>{app.version}</span>}
                        {app.estimatedSizeMB && <span>· {app.estimatedSizeMB} MB</span>}
                        {app.installDate && <span>· {app.installDate}</span>}
                      </div>
                      {app.installLocation && (
                        <div
                          className="text-[9px] font-mono text-slate-700 truncate mt-0.5"
                          title={app.installLocation}
                        >
                          {app.installLocation}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      title={
                        app.exePath
                          ? `Launch ${app.name}${status === "error" ? ` — ${launchError ?? "failed"}` : ""}`
                          : "No launchable executable found"
                      }
                      onClick={() => handleLaunch(app.id)}
                      disabled={!app.exePath || status === "launching"}
                      className={cn(
                        "shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all duration-300",
                        app.exePath
                          ? "border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20 hover:border-cyan-400/50"
                          : "border border-slate-800/50 bg-navy-950/30 text-slate-600 cursor-not-allowed",
                        status === "launching" && "opacity-60 cursor-wait",
                        status === "launched" && "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
                        status === "error" && "border-rose-400/40 bg-rose-400/10 text-rose-300"
                      )}
                    >
                      {status === "launching" ? (
                        <>
                          <RefreshCw size={11} className="animate-spin" /> Opening
                        </>
                      ) : status === "launched" ? (
                        <>
                          <Check size={11} /> Launched
                        </>
                      ) : status === "error" ? (
                        <>
                          <AlertTriangle size={11} /> Failed
                        </>
                      ) : (
                        <>
                          <Rocket size={11} /> Launch
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}