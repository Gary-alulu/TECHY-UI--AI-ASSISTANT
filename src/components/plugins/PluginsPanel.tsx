"use client";

import React, { useCallback, useEffect, useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { HUDButton } from "../ui/HUDButton";
import { Puzzle, Plus, Play, Trash2, Loader2, Zap, Power } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PluginCategory, PluginDef } from "@/types";

const CATEGORY_COLORS: Record<PluginCategory, string> = {
  Core: "text-cyan-400",
  File: "text-emerald-400",
  System: "text-violet-400",
  Browser: "text-sky-400",
  Developer: "text-amber-400",
  Creative: "text-rose-400",
  Custom: "text-slate-300",
};

export function PluginsPanel() {
  const [plugins, setPlugins] = useState<PluginDef[]>([]);
  const [groups, setGroups] = useState<Array<{ label: string; tools: string[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<PluginCategory>("Custom");
  const [permissions, setPermissions] = useState("fileAccess");
  const [output, setOutput] = useState("");
  const [action, setAction] = useState<"text" | "notify">("text");
  const [installing, setInstalling] = useState(false);
  const [result, setResult] = useState<{ id: string; output: string; action: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/plugins", { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { plugins: PluginDef[]; groups: Array<{ label: string; tools: string[] }> };
      setPlugins(data.plugins);
      setGroups(data.groups);
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

  const install = async () => {
    if (!name.trim() || installing) return;
    setInstalling(true);
    try {
      await fetch("/api/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || `${name} custom plugin`,
          category,
          permissions: permissions.split(",").map((entry) => entry.trim()).filter(Boolean),
          inputs: [],
          outputs: [],
          execute: { action, output, message: output },
        }),
      });
      setName("");
      setDescription("");
      setOutput("");
      setShowForm(false);
      await load();
    } catch {
      // ignore
    } finally {
      setInstalling(false);
    }
  };

  const run = async (id: string) => {
    try {
      const response = await fetch(`/api/plugins/${id}/run`, { method: "POST" });
      const data = (await response.json()) as { output: string; action: string };
      setResult({ id, output: data.output, action: data.action });
    } catch {
      setResult({ id, output: "Request failed", action: "unknown" });
    }
  };

  const toggle = async (id: string, enabled: boolean) => {
    if (installing) return;
    const plugin = plugins.find((entry) => entry.id === id);
    if (plugin?.builtin) return;
    try {
      await fetch(`/api/plugins/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      await load();
    } catch {
      // ignore
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/plugins/${id}`, { method: "DELETE" });
      await load();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-600">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  const custom = plugins.filter((plugin) => !plugin.builtin);
  const builtins = plugins.filter((plugin) => plugin.builtin);

  return (
    <div className="space-y-6">
      {result && (
        <div className="p-3 rounded-lg border border-cyan-400/20 bg-cyan-950/20 flex items-center gap-2 text-[11px] font-mono">
          <Zap size={12} className="text-cyan-400 shrink-0" />
          <span className="text-slate-300 flex-1 truncate">{result.output || "No output"}</span>
          <button type="button" onClick={() => setResult(null)} className="text-slate-500 hover:text-slate-300">✕</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Built-in catalog · {builtins.length} · Custom · {custom.length}</p>
        <HUDButton variant="outline" size="sm" onClick={() => setShowForm((value) => !value)}>
          <Plus size={12} /> {showForm ? "Cancel" : "New Plugin"}
        </HUDButton>
      </div>

      {showForm && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 border border-slate-800/60 bg-navy-950/50 rounded-xl p-4">
          <div className="space-y-3">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Plugin name" maxLength={60} className="w-full bg-navy-950/60 border border-slate-800/60 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50" />
            <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" maxLength={140} className="w-full bg-navy-950/60 border border-slate-800/60 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50" />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[10px] font-mono text-slate-500">
                Category
                <select value={category} onChange={(event) => setCategory(event.target.value as PluginCategory)} className="mt-1 w-full bg-navy-950/60 border border-slate-800/60 rounded-lg px-2 py-2 text-xs font-mono text-slate-300">
                  {(["Custom", "Core", "File", "System", "Browser", "Developer", "Creative"] as PluginCategory[]).map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                </select>
              </label>
              <label className="text-[10px] font-mono text-slate-500">
                Permissions (comma list)
                <input value={permissions} onChange={(event) => setPermissions(event.target.value)} placeholder="fileAccess" className="mt-1 w-full bg-navy-950/60 border border-slate-800/60 rounded-lg px-2 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50" />
              </label>
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-mono text-slate-500">
              Behaviour
              <select value={action} onChange={(event) => setAction(event.target.value as "text" | "notify")} className="mt-1 w-full bg-navy-950/60 border border-slate-800/60 rounded-lg px-2 py-2 text-xs font-mono text-slate-300">
                <option value="text">Return text</option>
                <option value="notify">Post a notification</option>
              </select>
            </label>
            <input value={output} onChange={(event) => setOutput(event.target.value)} placeholder={action === "notify" ? "Notification message" : "Output text"} maxLength={200} className="w-full bg-navy-950/60 border border-slate-800/60 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50" />
            <HUDButton size="sm" onClick={install} disabled={!name.trim() || installing}>
              {installing ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Install
            </HUDButton>
          </div>
        </div>
      )}

      {groups.map((group) => {
        if (group.tools.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2">{group.tools.length} tool(s) in {group.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.tools.map((tool) => (
                <span key={tool} className="text-[10px] font-mono text-slate-500 bg-navy-950/40 border border-slate-800/50 rounded px-1.5 py-0.5">{tool}</span>
              ))}
            </div>
          </div>
        );
      })}

      <div className="space-y-2.5">
        {plugins.map((plugin) => (
          <GlassPanel key={plugin.id} className="flex items-center gap-3" padding="md">
            <div className={cn("w-8 h-8 rounded-lg border border-slate-800/50 bg-navy-950/40 flex items-center justify-center shrink-0", CATEGORY_COLORS[plugin.category])}>
              <Puzzle size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-slate-100">{plugin.name}</p>
                <span className={cn("text-[8px] font-mono uppercase tracking-widest", CATEGORY_COLORS[plugin.category])}>{plugin.category}</span>
                {plugin.builtin && <span className="text-[8px] font-mono uppercase tracking-widest text-slate-600">built-in</span>}
              </div>
              <p className="text-[10px] text-slate-500 truncate">{plugin.description}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <HUDButton variant="ghost" size="sm" onClick={() => run(plugin.id)} disabled={!plugin.enabled} title="Run now">
                <Play size={11} />
              </HUDButton>
              {!plugin.builtin && (
                <>
                  <button type="button" onClick={() => toggle(plugin.id, !plugin.enabled)} className={cn("p-1.5 rounded", plugin.enabled ? "text-emerald-400" : "text-slate-600")} title={plugin.enabled ? "Disable" : "Enable"}>
                    <Power size={12} />
                  </button>
                  <button type="button" onClick={() => remove(plugin.id)} className="p-1.5 rounded text-slate-600 hover:text-rose-300" title="Remove">
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          </GlassPanel>
        ))}
      </div>
    </div>
  );
}