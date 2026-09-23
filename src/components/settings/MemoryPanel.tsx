"use client";

import React, { useCallback, useEffect, useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { HUDButton } from "../ui/HUDButton";
import { Brain, Plus, Trash2, Loader2, Info, AlertTriangle, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface MemoryFact {
  id: string;
  content: string;
  kind: "fact" | "preference";
  source: string;
  createdAt: string;
}

export function MemoryPanel() {
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [preferences, setPreferences] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<MemoryFact["kind"]>("fact");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/memory", { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { facts: MemoryFact[]; preferences: Record<string, string> };
      setFacts(data.facts ?? []);
      setPreferences(data.preferences ?? {});
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(load);
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = content.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value, kind }),
        cache: "no-store",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to save");
      }
      setContent("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save memory");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const response = await fetch(`/api/memory/${id}`, { method: "DELETE", cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove entry");
    }
  };

  const removePreference = async (key: string) => {
    try {
      const response = await fetch(`/api/memory/preferences/${encodeURIComponent(key)}`, { method: "DELETE", cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove preference");
    }
  };

  const clearAll = async () => {
    if (!confirm("Forget every remembered fact? This cannot be undone.")) return;
    try {
      const response = await fetch("/api/memory", { method: "DELETE", cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear memory");
    }
  };

  const preferenceEntries = Object.entries(preferences);

  return (
    <GlassPanel
      header="Memory"
      className="h-full flex flex-col"
      headerAction={
        <HUDButton variant="ghost" size="sm" onClick={clearAll} disabled={facts.length === 0} className="text-rose-400">
          Forget everything
        </HUDButton>
      }
    >
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
        <div className="flex items-start gap-2 p-2.5 rounded-lg border border-slate-800/50 bg-navy-950/40 text-[11px] text-slate-400 leading-relaxed">
          <Info size={13} className="text-cyan-400/70 shrink-0 mt-0.5" />
          <span>
            TECHY remembers these locally. Tell it things like <span className="font-mono text-cyan-400/80">“remember that I work in design”</span> in chat, and it will use them as context for answers.
          </span>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[10px] font-mono text-rose-400">
            <AlertTriangle size={12} className="shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        )}

        <form onSubmit={add} className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-navy-950/50 border border-slate-800/50 focus-within:border-cyan-400/40 transition-colors">
            <Brain size={13} className="text-slate-500 shrink-0" />
            <input
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="What should I remember? (e.g. I work in design)"
              maxLength={400}
              className="bg-transparent text-xs font-mono text-slate-200 placeholder:text-slate-600 outline-none w-full py-0.5"
            />
          </div>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as MemoryFact["kind"])}
            title="Fact or preference"
            className="bg-navy-950/50 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-400/40"
          >
            <option value="fact">Fact</option>
            <option value="preference">Preference</option>
          </select>
          <HUDButton type="submit" size="sm" disabled={!content.trim() || saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          </HUDButton>
        </form>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-14 rounded-lg bg-slate-800/30 border border-slate-800/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {preferenceEntries.length > 0 && (
              <div>
                <span className="text-[9px] font-mono uppercase tracking-widest text-amber-400">Preferences</span>
                <div className="mt-1.5 space-y-1.5">
                  {preferenceEntries.map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 p-2 rounded-lg border border-slate-800/50 bg-navy-950/40">
                      <Star size={12} className="text-amber-400/80 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono text-slate-300 truncate">
                          <span className="text-cyan-400/80">{key}</span>
                          <span className="text-slate-600 mx-1">=</span>
                          {value}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePreference(key)}
                        className="p-1 rounded-md text-slate-600 hover:text-rose-300 hover:bg-rose-500/10 transition-colors shrink-0"
                        title={`Remove ${key}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <span className="text-[9px] font-mono uppercase tracking-widest text-cyan-400">Facts ({facts.length})</span>
              {facts.length === 0 && (
                <p className="text-[11px] font-mono text-slate-700 mt-1.5">
                  Nothing remembered yet.
                </p>
              )}
              <div className="mt-1.5 space-y-1.5">
                {facts.map((fact) => (
                  <div
                    key={fact.id}
                    className={cn(
                      "flex items-start gap-2 p-2 rounded-lg border bg-navy-950/40",
                      fact.kind === "preference" ? "border-amber-400/20" : "border-slate-800/50"
                    )}
                  >
                    <span
                      className={cn(
                        "px-1 py-px rounded text-[8px] font-mono uppercase tracking-widest mt-0.5 shrink-0",
                        fact.kind === "preference"
                          ? "bg-amber-400/10 text-amber-400"
                          : "bg-cyan-400/10 text-cyan-400"
                      )}
                    >
                      {fact.kind}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 leading-snug">{fact.content}</p>
                      <p className="text-[9px] font-mono text-slate-600 mt-0.5">
                        {fact.source} · {new Date(fact.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(fact.id)}
                      className="p-1 rounded-md text-slate-600 hover:text-rose-300 hover:bg-rose-500/10 transition-colors shrink-0"
                      title="Remove"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </GlassPanel>
  );
}