"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/context/BrandContext";
import { HUDButton } from "@/components/ui/HUDButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Brain, Database, Loader2, Plus, Sparkles, Trash2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

interface MemoryFact {
  id: string;
  content: string;
  kind: "fact" | "preference";
  source: string;
  createdAt: string;
}

interface MemoryStore {
  facts: MemoryFact[];
  preferences: Record<string, string>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MemoryInspector() {
  const { accent } = useBrand();
  const [store, setStore] = useState<MemoryStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newFact, setNewFact] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/memory", { cache: "no-store" });
      if (response.ok) {
        setStore((await response.json()) as MemoryStore);
      }
      setError(null);
    } catch {
      setError("Could not read memory store");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const addFact = useCallback(async () => {
    const content = newFact.trim();
    if (!content) return;
    setAdding(true);
    try {
      const response = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, source: "memory-inspector" }),
      });
      if (response.ok) {
        setNewFact("");
        await load();
      } else {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Could not save memory");
      }
    } catch {
      setError("Could not save memory");
    } finally {
      setAdding(false);
    }
  }, [newFact, load]);

  const removeFact = useCallback(async (id: string) => {
    await fetch(`/api/memory/${id}`, { method: "DELETE" });
    setStore((current) => (current ? { ...current, facts: current.facts.filter((fact) => fact.id !== id) } : current));
  }, []);

  const factCount = store?.facts.length ?? 0;
  const preferenceCount = Object.keys(store?.preferences ?? {}).length;

  return (
    <div className="flex flex-col gap-5">
      <GlassPanel className="p-4 flex items-center justify-between gap-3 border-slate-800">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <Brain size={15} className="text-cyan-400" />
          <span>
            {loading ? "Reading memory store…" : store
              ? `${factCount} fact${factCount === 1 ? "" : "s"} · ${preferenceCount} preference${preferenceCount === 1 ? "" : "s"} · everything below is what he uses when replying`
              : "Memory empty"}
          </span>
        </div>
      </GlassPanel>

      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-400/20 bg-amber-950/15 text-xs text-amber-300">
          <span className="min-w-0">{error}</span>
        </div>
      )}

      {loading && !store && (
        <GlassPanel className="p-8 flex items-center justify-center text-slate-500">
          <Loader2 size={20} className="animate-spin text-cyan-400 mr-3" />
          <span className="font-mono text-xs">Loading memory…</span>
        </GlassPanel>
      )}

      {store && (
        <>
          <GlassPanel className="p-5 flex flex-col gap-3 border-cyan-400/20" hudCorners>
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
              <Plus size={11} className="text-cyan-400" /> Teach something new
            </div>
            <div className="flex gap-2">
              <input
                value={newFact}
                onChange={(event) => setNewFact(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void addFact();
                }}
                placeholder='"I prefer dark mode" or "My design software is Figma"'
                className="flex-1 rounded-lg bg-navy-950/70 border border-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50"
              />
              <HUDButton variant="default" onClick={() => void addFact()} disabled={!newFact.trim() || adding}>
                {adding ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <Sparkles size={13} className="mr-1.5" />}
                Remember
              </HUDButton>
            </div>
          </GlassPanel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <GlassPanel header={`Facts · ${factCount}`} className="p-5 gap-3 border-slate-800" hudCorners>
              <div className="flex flex-col gap-2">
                {store.facts.length === 0 && <p className="text-xs text-slate-500">Nothing remembered yet — teach TECHY something on the panel above.</p>}
                {store.facts.map((fact) => (
                  <div key={fact.id} className="flex items-start gap-3 rounded-lg bg-navy-950/50 border border-slate-800/70 px-3 py-2.5">
                    <Brain size={13} className="mt-0.5 shrink-0 text-slate-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-200 leading-relaxed">{fact.content}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-slate-600">
                        <span className={cn("px-1.5 py-0.5 rounded", fact.kind === "preference" ? "text-amber-300 border border-amber-400/30" : "text-cyan-300 border border-cyan-400/30")}>
                          {fact.kind}
                        </span>
                        <span>{fact.source}</span>
                        <span>· {formatDate(fact.createdAt)}</span>
                      </div>
                    </div>
                    <HUDButton variant="ghost" size="sm" className="text-red-400 shrink-0" onClick={() => void removeFact(fact.id)}>
                      <Trash2 size={13} />
                    </HUDButton>
                  </div>
                ))}
              </div>
            </GlassPanel>

            <GlassPanel header={`Preferences · ${preferenceCount}`} className="p-5 gap-3 border-slate-800" hudCorners>
              <div className="flex flex-col gap-2">
                {Object.entries(store.preferences).length === 0 && <p className="text-xs text-slate-500">No preferences stored.</p>}
                {Object.entries(store.preferences).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-3 rounded-lg bg-navy-950/50 border border-slate-800/70 px-3 py-2.5">
                    <UserRound size={13} className="shrink-0 text-slate-500" />
                    <span className="text-[11px] font-mono text-cyan-300/90 w-36 truncate shrink-0">{key}</span>
                    <span className="text-xs text-slate-300 min-w-0 break-all">{value}</span>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Database size={11} className="shrink-0" style={{ color: accent.hex }} />
            <span>Memory is stored locally in /data and never leaves this machine. Deleting a fact removes it from future replies.</span>
          </div>
        </>
      )}
    </div>
  );
}