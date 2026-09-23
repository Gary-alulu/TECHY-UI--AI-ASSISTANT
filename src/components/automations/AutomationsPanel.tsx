"use client";

import React, { useCallback, useEffect, useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { HUDButton } from "../ui/HUDButton";
import { Workflow, Play, Trash2, Plus, Loader2, ChevronDown, FileSearch, Clock, Zap, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Automation, AutomationActionName } from "@/types";

const ACTION_LABELS: Record<AutomationActionName, string> = {
  read_text: "Read file text",
  summarize: "Summarize (offline)",
  rename: "Rename file",
  move: "Move to folder",
  notify: "Notify TECHY",
  create_task: "Create a task",
  briefing: "Post daily briefing",
};

const ACTION_KEYS = Object.keys(ACTION_LABELS) as AutomationActionName[];

export function AutomationsPanel() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<"file_watch" | "schedule" | "manual">("file_watch");
  const [folder, setFolder] = useState("watch");
  const [pattern, setPattern] = useState("*.pdf");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [time, setTime] = useState("09:00");
  const [actions, setActions] = useState<AutomationActionName[]>(["read_text", "summarize", "rename", "move", "notify"]);
  const [renamePattern, setRenamePattern] = useState("{name}-{date}{ext}");
  const [moveTarget, setMoveTarget] = useState("processed");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/automations", { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { automations: Automation[] };
      setAutomations(data.automations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(load);
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const toggleAction = (key: AutomationActionName) => {
    setActions((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || actions.length === 0 || creating) return;
    setCreating(true);
    const [hour, minute] = time.split(":").map(Number);
    const trigger =
      triggerType === "file_watch"
        ? { type: "file_watch" as const, folder: folder.trim() || "watch", pattern: pattern.trim() || "*" }
        : triggerType === "schedule"
          ? { type: "schedule" as const, dayOfWeek, hour, minute }
          : { type: "manual" as const };
    const actionList = actions.map((actionName) => {
      const params: Record<string, string> = {};
      if (actionName === "rename") params.pattern = renamePattern;
      if (actionName === "move") params.target = moveTarget;
      return { name: actionName, params: Object.keys(params).length > 0 ? params : undefined };
    });
    try {
      const response = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, trigger, actions: actionList }),
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      setName("");
      setActions(["read_text", "summarize", "rename", "move", "notify"]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workflow");
    } finally {
      setCreating(false);
    }
  };

  const patch = async (id: string, changes: Record<string, unknown>) => {
    try {
      await fetch(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/automations/${id}`, { method: "DELETE" });
    await load();
  };

  const run = async (id: string) => {
    setRunningId(id);
    try {
      const response = await fetch(`/api/automations/${id}/run`, { method: "POST" });
      if (!response.ok) throw new Error("Run failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunningId(null);
    }
  };

  const triggerLabel = (automation: Automation) => {
    const trigger = automation.trigger;
    if (trigger.type === "file_watch") return `new ${trigger.pattern || "files"} → ${trigger.folder}`;
    if (trigger.type === "schedule") {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return `${days[trigger.dayOfWeek]} ${String(trigger.hour).padStart(2, "0")}:${String(trigger.minute).padStart(2, "0")}`;
    }
    return "manual only";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0">
      {/* Workflow List */}
      <GlassPanel header="Workflows" className="lg:col-span-2 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
          {error && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[10px] font-mono text-rose-400">
              <AlertTriangle size={12} className="shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, index) => <div key={index} className="h-16 rounded-lg bg-slate-800/30 animate-pulse" />)}
            </div>
          ) : automations.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Workflow size={28} className="text-slate-700 mb-3" />
              <p className="text-[11px] font-mono text-slate-600 max-w-xs">
                No workflows yet. Create one — e.g. “when a new PDF lands in watch, read it, summarize, rename, move to processed and notify me.”
              </p>
            </div>
          ) : (
            automations.map((automation) => {
              const isExpanded = expanded === automation.id;
              const isRunning = runningId === automation.id;
              return (
                <div key={automation.id} className="rounded-lg border border-slate-800/50 bg-navy-950/40 overflow-hidden">
                  <div className="p-3">
                    <div className="flex items-center gap-2">
                      <Workflow size={14} className="text-cyan-400/80 shrink-0" />
                      <span className="flex-1 text-xs font-semibold text-slate-200 truncate">{automation.name}</span>
                      <span className="text-[9px] font-mono text-slate-600 shrink-0">{triggerLabel(automation)}</span>
                      <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0", automation.lastStatus === "completed" ? "bg-emerald-500/10 text-emerald-400" : automation.lastStatus === "failed" ? "bg-rose-500/10 text-rose-400" : "bg-slate-700/20 text-slate-500")}>
                        {automation.lastStatus ?? "never"}
                      </span>
                    </div>
                    {automation.description && <p className="text-[10px] text-slate-500 mt-1">{automation.description}</p>}
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {automation.actions.map((action) => (
                        <span key={action.name} className="text-[9px] font-mono text-cyan-400/70 bg-cyan-950/30 px-1.5 py-0.5 rounded">{action.name}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 mt-3 justify-end">
                      <button
                        type="button"
                        onClick={() => { setExpanded(isExpanded ? null : automation.id); if (isExpanded) setExpanded(null); }}
                        className="p-1.5 rounded text-slate-500 hover:text-cyan-300 hover:bg-slate-800/50"
                        title="Run log"
                      >
                        <ChevronDown size={14} className={cn("transition-transform", isExpanded && "rotate-180")} />
                      </button>
                      <HUDButton variant="outline" size="sm" onClick={() => run(automation.id)} disabled={isRunning} className="h-7 px-2 text-[10px]">
                        {isRunning ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />} run
                      </HUDButton>
                      <button
                        type="button"
                        onClick={() => patch(automation.id, { enabled: !automation.enabled })}
                        className={cn("px-2 py-1 rounded-md text-[10px] font-mono border transition-colors", automation.enabled ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-slate-800/40 text-slate-600 border-slate-700/40")}
                      >
                        {automation.enabled ? "ENABLED" : "PAUSED"}
                      </button>
                      <button type="button" onClick={() => remove(automation.id)} className="p-1.5 rounded text-slate-600 hover:text-rose-300 hover:bg-slate-800/50" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-800/50 px-3 py-2 bg-navy-950/60 space-y-1.5 max-h-44 overflow-y-auto">
                      {automation.runs.length === 0 ? (
                        <p className="text-[10px] font-mono text-slate-700 py-2 text-center">No runs yet.</p>
                      ) : (
                        automation.runs.map((run) => (
                          <div key={run.id} className="flex items-start gap-2 text-[10px] font-mono">
                            <span className={cn("shrink-0 mt-0.5", run.status === "completed" ? "text-emerald-400" : "text-rose-400")}>
                              {run.status === "completed" ? "✓" : "✗"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-slate-400">{run.summary}</p>
                              <p className="text-[9px] text-slate-600 mt-0.5">
                                {new Date(run.startedAt).toLocaleString()} — {run.actions.map((action) => `${action.name} ${action.status === "completed" ? "ok" : "fail"}`).join(" · ")}
                              </p>
                              {run.status === "failed" && run.actions.filter((action) => action.status === "failed").map((action, index) => (
                                <p key={index} className="text-[9px] text-rose-400/80 mt-0.5">{action.detail}</p>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="shrink-0 mt-2 text-[10px] font-mono text-slate-600 flex items-center gap-2 px-1">
          <Zap size={11} className="text-cyan-500" />
          File-watch workflows poll on each visit; scheduled workflows fire by weekday + time while TECHY is running.
        </div>
      </GlassPanel>

      {/* Create Form */}
      <div>
        <GlassPanel header="New workflow" className="flex flex-col">
          <form onSubmit={create} className="space-y-3 flex-1">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1.5">Name</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. PDF auto-processor"
                maxLength={80}
                className="w-full bg-navy-950/60 border border-slate-800/60 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50"
              />
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {(["file_watch", "schedule", "manual"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTriggerType(type)}
                  className={cn("px-2 py-1.5 rounded-md border text-[10px] font-mono transition-colors flex items-center justify-center gap-1", triggerType === type ? "border-cyan-400/50 bg-cyan-950/30 text-cyan-300" : "border-slate-800/60 text-slate-500 hover:text-slate-300")}
                >
                  {type === "file_watch" ? <FileSearch size={11} /> : type === "schedule" ? <Clock size={11} /> : <Play size={11} />}
                  {type.replace("_", " ")}
                </button>
              ))}
            </div>

            {triggerType === "file_watch" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1.5">Folder (in /data)</label>
                  <input value={folder} onChange={(event) => setFolder(event.target.value)} className="w-full bg-navy-950/60 border border-slate-800/60 rounded-lg px-2.5 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400/50" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1.5">Pattern</label>
                  <input value={pattern} onChange={(event) => setPattern(event.target.value)} className="w-full bg-navy-950/60 border border-slate-800/60 rounded-lg px-2.5 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400/50" />
                </div>
              </div>
            )}

            {triggerType === "schedule" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1.5">Weekday</label>
                  <select
                    value={dayOfWeek}
                    onChange={(event) => setDayOfWeek(Number(event.target.value))}
                    className="w-full bg-navy-950/60 border border-slate-800/60 rounded-lg px-2.5 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400/50"
                  >
                    {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => (
                      <option key={day} value={index}>{day}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1.5">Time</label>
                  <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="w-full bg-navy-950/60 border border-slate-800/60 rounded-lg px-2.5 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400/50 [color-scheme:dark]" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1.5">Actions (in order)</label>
              <div className="space-y-1">
                {ACTION_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleAction(key)}
                    className={cn("w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-[11px] font-mono transition-colors", actions.includes(key) ? "border-cyan-400/40 bg-cyan-950/20 text-cyan-200" : "border-slate-800/60 text-slate-500 hover:text-slate-300")}
                  >
                    <span className={cn("w-3 h-3 rounded-sm border flex items-center justify-center text-[8px]", actions.includes(key) ? "bg-cyan-400 border-cyan-400 text-navy-950" : "border-slate-600")}>
                      {actions.includes(key) ? "✓" : ""}
                    </span>
                    {ACTION_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>

            {actions.includes("rename") && (
              <input value={renamePattern} onChange={(event) => setRenamePattern(event.target.value)} placeholder="Rename pattern: {name}-{date}{ext}" className="w-full bg-navy-950/60 border border-slate-800/60 rounded-lg px-2.5 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400/50" />
            )}
            {actions.includes("move") && (
              <input value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)} placeholder="Move target folder (in /data)" className="w-full bg-navy-950/60 border border-slate-800/60 rounded-lg px-2.5 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400/50" />
            )}

            <HUDButton type="submit" disabled={!name.trim() || actions.length === 0 || creating} className="w-full">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create workflow
            </HUDButton>
          </form>
        </GlassPanel>
      </div>
    </div>
  );
}