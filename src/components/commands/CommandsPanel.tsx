"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/context/BrandContext";
import { HUDButton } from "@/components/ui/HUDButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { BookmarkPlus, History, Loader2, Plus, Search, Terminal, Trash2 } from "lucide-react";
import type { CommandHistoryEntry, CommandTemplate } from "@/types";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<string, string> = {
  general: "General",
  files: "Files",
  system: "System",
  apps: "Apps",
  productivity: "Productivity",
  research: "Research",
};

const CATEGORY_COLOR: Record<string, string> = {
  general: "text-slate-300 border-slate-600 bg-slate-800/50",
  files: "text-amber-300 border-amber-400/30 bg-amber-950/20",
  system: "text-cyan-300 border-cyan-400/30 bg-cyan-950/20",
  apps: "text-violet-300 border-violet-400/30 bg-violet-950/20",
  productivity: "text-emerald-300 border-emerald-400/30 bg-emerald-950/20",
  research: "text-pink-300 border-pink-400/30 bg-pink-950/20",
};

function formatRelative(value: string): string {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (Number.isNaN(date.getTime())) return "";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function CommandsPanel() {
  const { accent } = useBrand();
  const [history, setHistory] = useState<CommandHistoryEntry[]>([]);
  const [templates, setTemplates] = useState<CommandTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [category, setCategory] = useState<CommandTemplate["category"]>("general");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/commands", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { history: CommandHistoryEntry[]; templates: CommandTemplate[] };
        setHistory(data.history);
        setTemplates(data.templates);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load commands");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const addTemplate = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const response = await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "template", text: trimmed, label: label.trim() || undefined, category }),
      });
      if (response.ok) {
        setText("");
        setLabel("");
        await load();
      } else {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Could not save template");
      }
    } finally {
      setAdding(false);
    }
  }, [text, label, category, load]);

  const removeTemplate = useCallback(async (id: string) => {
    await fetch(`/api/commands?id=${encodeURIComponent(id)}&target=template`, { method: "DELETE" });
    setTemplates((current) => current.filter((template) => template.id !== id));
  }, []);

  const removeHistory = useCallback(async (id: string) => {
    await fetch(`/api/commands?id=${encodeURIComponent(id)}&target=history`, { method: "DELETE" });
    setHistory((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const clearHistory = useCallback(async () => {
    await fetch("/api/commands?target=clear", { method: "DELETE" });
    setHistory([]);
  }, []);

  const copyCommand = useCallback((value: string) => {
    void navigator.clipboard?.writeText(value).catch(() => {});
  }, []);

  const visibleHistory = history.filter((entry) => entry.text.toLowerCase().includes(filter.toLowerCase()));
  const visibleTemplates = templates.filter((entry) => entry.text.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      {/* Templates */}
      <GlassPanel header={`Command Templates · ${templates.length}`} className="p-5 gap-3 border-cyan-400/20" hudCorners>
        <div className="flex flex-col gap-2.5">
          {visibleTemplates.length === 0 && <p className="text-xs text-slate-500">No templates yet — save one below to keep a phrase one tap away.</p>}
          {visibleTemplates.map((template) => (
            <div key={template.id} className="flex items-center gap-3 rounded-lg bg-navy-950/50 border border-slate-800/70 px-3 py-2.5 group">
              <Terminal size={13} className="shrink-0 text-slate-500" />
              <button type="button" onClick={() => copyCommand(template.text)} className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-slate-200">{template.label}</span>
                  <span className={cn("px-1.5 py-0.5 rounded font-mono text-[9px] uppercase tracking-wider border", CATEGORY_COLOR[template.category] ?? CATEGORY_COLOR.general)}>
                    {CATEGORY_LABEL[template.category] ?? template.category}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{template.text}</p>
              </button>
              <HUDButton variant="ghost" size="sm" className="text-red-400 shrink-0" onClick={() => void removeTemplate(template.id)}>
                <Trash2 size={13} />
              </HUDButton>
            </div>
          ))}
        </div>

        {/* Add template */}
        <div className="mt-2 pt-3 border-t border-slate-800/70 flex flex-col gap-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Label (e.g. Start briefing)"
              className="rounded-lg bg-navy-950/70 border border-slate-800 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50"
            />
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void addTemplate();
              }}
              placeholder="Command text (e.g. Prepare my daily briefing)"
              className="rounded-lg bg-navy-950/70 border border-slate-800 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50"
            />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as CommandTemplate["category"])}
              className="rounded-lg bg-navy-950/70 border border-slate-800 px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-400/50"
            >
              {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <HUDButton variant="outline" size="sm" className="self-start text-cyan-300 border-cyan-400/30" onClick={() => void addTemplate()} disabled={!text.trim() || adding}>
            {adding ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <BookmarkPlus size={12} className="mr-1.5" />}
            Save template
          </HUDButton>
        </div>
      </GlassPanel>

      {/* History */}
      <GlassPanel
        header={`Command History · ${history.length}`}
        headerAction={
          history.length > 0 ? (
            <div className="flex gap-1.5">
              <HUDButton variant="ghost" size="sm" className="text-white" onClick={() => void clearHistory()}>
                <Trash2 size={12} className="mr-1.5" /> Clear
              </HUDButton>
            </div>
          ) : undefined
        }
        className="p-5 gap-3 border-slate-800"
        hudCorners
      >
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter commands…"
            className="w-full rounded-lg bg-navy-950/70 border border-slate-800 pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50"
          />
        </div>
        <div className="flex flex-col gap-2 max-h-[480px] overflow-y-auto pr-1">
          {loading && <p className="text-xs text-slate-500"><Loader2 size={12} className="animate-spin inline mr-1.5" />Loading…</p>}
          {!loading && visibleHistory.length === 0 && (
            <p className="text-xs text-slate-500">{history.length === 0 ? "Nothing asked yet — commands you send in Chat appear here automatically." : "No commands match that filter."}</p>
          )}
          {visibleHistory.map((entry, index) => (
            <div key={entry.id} className="flex items-center gap-3 rounded-lg bg-navy-950/50 border border-slate-800/70 px-3 py-2.5 group">
              <span className="font-mono text-[10px] text-slate-600 w-6 shrink-0">{String(history.length - index).padStart(2, "0")}</span>
              <button type="button" onClick={() => copyCommand(entry.text)} className="flex-1 min-w-0 text-left" title="Click to copy">
                <div className="text-xs text-slate-200 truncate group-hover:text-cyan-300 transition-colors">{entry.text}</div>
                <div className="text-[10px] font-mono text-slate-600 mt-0.5 flex items-center gap-2">
                  <History size={9} className="inline" />
                  <span>{entry.source}</span>
                  <span>· {formatRelative(entry.createdAt)}</span>
                </div>
              </button>
              <HUDButton variant="ghost" size="sm" className="text-red-400 shrink-0" onClick={() => void removeHistory(entry.id)}>
                <Trash2 size={13} />
              </HUDButton>
            </div>
          ))}
        </div>
      </GlassPanel>

      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-400/20 bg-amber-950/15 text-xs text-amber-300">
          <span className="min-w-0">{error}</span>
        </div>
      )}

      <p className="text-[11px] text-slate-500 flex items-center gap-2">
        <Plus size={11} className="shrink-0" style={{ color: accent.hex }} />
        History is recorded automatically every time you chat with TECHY — up to 200 entries, with exact duplicates collapsed.
      </p>
    </div>
  );
}