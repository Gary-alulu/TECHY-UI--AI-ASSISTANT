"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
import { HUDButton } from "../ui/HUDButton";
import { FileSearch, Search, Loader2, Hash, Clock, FileText, AlertTriangle } from "lucide-react";

interface KnowledgeHit {
  path: string;
  name: string;
  score: number;
  terms: string[];
  snippet: string;
  size: number;
}

interface KnowledgeResponse {
  query: string;
  hits: KnowledgeHit[];
  indexed: { files: number; bytes: number; builtAt: number };
}

function highlight(snippet: string, terms: string[]): React.ReactNode[] {
  if (terms.length === 0) return [snippet];
  const lower = snippet.toLowerCase();
  const nodes: React.ReactNode[] = [];
  let current = snippet;
  let currentLower = lower;
  let key = 0;

  while (terms.length > 0) {
    let best = -1;
    let bestTerm = "";
    for (const term of terms) {
      const index = currentLower.indexOf(term);
      if (index !== -1 && (best === -1 || index < best)) {
        best = index;
        bestTerm = term;
      }
    }
    if (best === -1) break;
    if (best > 0) nodes.push(current.slice(0, best));
    nodes.push(
      <mark key={key++} className="bg-amber-400/20 text-amber-300 rounded-sm px-0.5">
        {current.slice(best, best + bestTerm.length)}
      </mark>
    );
    current = current.slice(best + bestTerm.length);
    currentLower = current.toLowerCase();
  }
  if (current) nodes.push(current);
  return nodes;
}

export function KnowledgeSearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgeHit[] | null>(null);
  const [indexed, setIndexed] = useState<{ files: number; bytes: number; builtAt: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ path: string; name: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadIndex = useCallback(async () => {
    try {
      const response = await fetch("/api/knowledge/stats", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as typeof indexed;
      setIndexed(data);
    } catch {
      // stats are optional
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(loadIndex);
    return () => cancelAnimationFrame(frame);
  }, [loadIndex]);

  const runSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (!value || searching) return;
    setSearching(true);
    setError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch(`/api/knowledge?q=${encodeURIComponent(value)}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as KnowledgeResponse;
      setResults(data.hits);
      setIndexed(data.indexed);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const openPath = async (path: string, name: string) => {
    setPreview({ path, name });
    setActivePath(path);
  };

  const fmtBytes = (size: number) => {
    if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    if (size >= 1024) return `${Math.round(size / 1024)} KB`;
    return `${size} B`;
  };

  return (
    <GlassPanel header="Knowledge Base" className="h-full flex flex-col" headerAction={<FileSearch size={16} className="text-cyan-400/70" />}>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 truncate">
          <Hash size={11} className="shrink-0" />
          {indexed ? (
            <span>
              {indexed.files} documents indexed · {fmtBytes(indexed.bytes)} ·{" "}
              <span className="text-cyan-400/70">workspace only</span>
            </span>
          ) : (
            <span>Indexing workspace…</span>
          )}
        </div>

        <form onSubmit={runSearch} className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-navy-950/50 border border-slate-800/50 focus-within:border-cyan-400/40 transition-colors">
            <Search size={13} className="text-slate-500 shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search documents… (e.g. Ollama, npm scripts, warranty)"
              className="bg-transparent text-xs font-mono text-slate-200 placeholder:text-slate-600 outline-none w-full py-0.5"
            />
          </div>
          <HUDButton type="submit" size="sm" disabled={!query.trim() || searching}>
            {searching ? <Loader2 size={14} className="animate-spin" /> : "Search"}
          </HUDButton>
        </form>

        {error && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[10px] font-mono text-rose-400">
            <AlertTriangle size={12} className="shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        )}

        <div className="space-y-2">
          {results === null && !searching && (
            <p className="text-[11px] font-mono text-slate-700 text-center py-6">
              Ranked, local, offline. Ask chat “search my notes for …” too.
            </p>
          )}

          {searching && results === null && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-16 rounded-lg bg-slate-800/30 border border-slate-800/50 animate-pulse" />
              ))}
            </div>
          )}

          {results?.length === 0 && !searching && (
            <p className="text-[11px] font-mono text-slate-600 text-center py-4">No documents matched.</p>
          )}

          {results?.map((hit) => (
            <button
              key={hit.path}
              type="button"
              onClick={() => openPath(hit.path, hit.name)}
              className={`w-full text-left p-2 rounded-lg border transition-colors ${
                activePath === hit.path
                  ? "border-cyan-400/40 bg-cyan-950/20"
                  : "border-slate-800/50 bg-navy-950/40 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText size={12} className="text-cyan-400/70 shrink-0" />
                <span className="flex-1 text-xs font-mono text-slate-300 truncate">{hit.name}</span>
                <span className="text-[9px] font-mono text-slate-600 shrink-0">score {hit.score}</span>
              </div>
              <p className="mt-1 text-[11px] font-mono text-slate-500 leading-relaxed line-clamp-3 break-words">
                {highlight(hit.snippet, hit.terms)}
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[9px] font-mono text-slate-700 truncate">{hit.path}</span>
                <Clock size={10} className="text-slate-700 shrink-0" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {preview && (
        <div className="shrink-0 border-t border-slate-800/60 bg-navy-950/60 p-2 flex items-center gap-2">
          <span className="flex-1 text-[10px] font-mono text-cyan-400/80 truncate">{preview.name}</span>
          <HUDButton variant="ghost" size="sm" onClick={() => setPreview(null)}>
            Close
          </HUDButton>
        </div>
      )}
    </GlassPanel>
  );
}