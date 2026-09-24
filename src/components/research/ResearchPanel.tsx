"use client";

import React, { useCallback, useRef, useState } from "react";
import { useBrand } from "@/context/BrandContext";
import { HUDButton } from "@/components/ui/HUDButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  AlertTriangle,
  BookOpen,
  Check,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileSearch,
  Globe,
  Loader2,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { ResearchReport } from "@/lib/research";

type Scope = "web" | "local";

const PIPELINE = [
  { id: "search", label: "Search sources" },
  { id: "fetch", label: "Fetch pages" },
  { id: "compare", label: "Compare across sources" },
  { id: "summarize", label: "Summarize with citations" },
];

function slugify(question: string): string {
  return question.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "research";
}

export function ResearchPanel() {
  const { brand, accent } = useBrand();
  const [question, setQuestion] = useState("");
  const [scope, setScope] = useState<Scope>("web");
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [gated, setGated] = useState<{ reason: string; internet: boolean; network: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const run = useCallback(
    async (target: Scope = scope) => {
      const value = question.trim();
      if (!value) return;
      setBusy(true);
      setError(null);
      setGated(null);
      setElapsed(0);
      stopTimer();
      timerRef.current = setInterval(() => setElapsed((total) => total + 1), 1000);
      try {
        const response = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: value, scope: target }),
          cache: "no-store",
        });
        if (response.status === 403) {
          const data = (await response.json()) as { error: string; reason: string; internet: boolean; network: string };
          setGated({ reason: data.reason, internet: data.internet, network: data.network });
          setReport(null);
          return;
        }
        if (!response.ok) throw new Error(`Research failed (${response.status})`);
        const data = (await response.json()) as ResearchReport;
        setReport(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Research could not complete");
      } finally {
        stopTimer();
        setBusy(false);
      }
    },
    [question, scope, stopTimer]
  );

  const download = useCallback(() => {
    if (!report) return;
    const blob = new Blob([report.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `techy-research-${slugify(report.question)}.md`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [report]);

  const copyReport = useCallback(async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy — this tab needs focus.");
    }
  }, [report]);

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      {/* Left: query + pipeline */}
      <GlassPanel className="lg:col-span-2 flex flex-col p-5 gap-4 border-cyan-400/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-navy-950 border flex items-center justify-center" style={{ borderColor: `${accent.hex}4d`, color: accent.hex, boxShadow: `0 0 16px ${accent.hex}33` }}>
            <FileSearch size={17} />
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: accent.hex }}>Research Mode</div>
            <h3 className="font-display font-medium text-slate-100 text-lg tracking-wide">Ask a question</h3>
          </div>
        </div>

        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void run();
          }}
          placeholder='"Find the documentation for this library…" — or research any topic.'
          className="w-full h-28 resize-none rounded-xl bg-navy-950/70 border border-slate-800 text-sm text-slate-200 placeholder:text-slate-600 p-3 font-mono focus:outline-none focus:border-cyan-400/50"
        />

        <div className="flex gap-2">
          {(["web", "local"] as Scope[]).map((mode) => {
            const selected = scope === mode;
            return (
              <HUDButton
                key={mode}
                variant={selected ? "default" : "outline"}
                size="sm"
                className={
                  selected && mode === "web"
                    ? "border-cyan-400/50 text-cyan-300"
                    : selected && mode === "local"
                      ? "border-emerald-400/50 text-emerald-300"
                      : "text-slate-400"
                }
                onClick={() => setScope(mode)}
                disabled={busy}
              >
                {mode === "web" ? <Globe size={12} className="mr-1.5" /> : <Database size={12} className="mr-1.5" />}
                {mode === "web" ? "Web research" : "Local brain"}
              </HUDButton>
            );
          })}
        </div>

        <HUDButton variant="default" className="self-start" onClick={() => void run()} disabled={!question.trim() || busy}>
          {busy ? <Loader2 size={13} className="animate-spin mr-2" /> : <Search size={13} className="mr-2" />}
          {busy ? `Researching… ${elapsed}s` : "Run research"}
        </HUDButton>

        {scope === "web" && !busy && !gated && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-400/15 bg-amber-950/10 text-[11px] text-slate-400">
            <Globe size={12} className="shrink-0 mt-0.5 text-amber-400" />
            <span>
              Web research fetches real pages through TECHY&apos;s SSRF-guarded fetcher. It honours the Security&nbsp;→
              Network policy — offline, it silently falls back to the local knowledge base.
            </span>
          </div>
        )}

        {gated && (
          <div className="flex flex-col gap-2 p-3 rounded-lg border border-amber-400/25 bg-amber-950/15">
            <div className="flex items-start gap-2 text-xs text-amber-200">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <span>{gated.reason}</span>
            </div>
            <HUDButton variant="outline" size="sm" className="self-start border-amber-400/30 text-amber-300" onClick={() => void run("local")} disabled={busy}>
              <Database size={12} className="mr-1.5" />
              Research locally instead
            </HUDButton>
            <a href="/security" className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300">
              Open Security →
            </a>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg border border-red-500/20 bg-red-950/20 text-xs text-red-300">
            <span className="min-w-0">{error}</span>
          </div>
        )}

        {!report && !busy && (
          <div className="mt-auto pt-4 border-t border-slate-800/70">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-3">Pipeline</div>
            <ol className="flex flex-col gap-2.5">
              {PIPELINE.map((step, index) => (
                <li key={step.id} className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                  <span className="w-5 text-right text-slate-600">{String(index + 1).padStart(2, "0")}</span>
                  <span className="w-3 text-center text-slate-700">○</span>
                  <span className="capitalize">{step.label}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </GlassPanel>

      {/* Right: report */}
      <GlassPanel className="lg:col-span-3 flex flex-col p-5 gap-4 border-cyan-400/20 min-h-[420px]">
        {busy ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 py-10">
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 size={22} className="animate-spin text-cyan-400" />
              <span className="font-mono text-xs">{scope === "web" ? "Searching web sources…" : "Searching local knowledge…"}</span>
            </div>
            <ol className="flex flex-col gap-2.5 text-[11px] font-mono">
              {PIPELINE.map((step, index) => (
                <li key={step.id} className="flex items-center gap-2 text-slate-400">
                  <span className="w-5 text-right text-slate-600">{String(index + 1).padStart(2, "0")}</span>
                  <span className="relative inline-flex h-3 w-3 items-center justify-center">
                    <span className="absolute h-full w-full rounded-full opacity-60 animate-ping" style={{ backgroundColor: accent.hex }} />
                    <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: accent.hex }} />
                  </span>
                  <span className="capitalize">{step.label}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : !report ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center text-slate-600 py-10">
            <div className="w-14 h-14 rounded-xl bg-navy-950 border border-slate-800 flex items-center justify-center text-slate-600">
              <BookOpen size={22} />
            </div>
            <p className="font-mono text-xs">Research report will appear here</p>
            <p className="text-[11px] text-slate-600 max-w-sm">
              Question → sources → findings → summary → citations. Downloadable as Markdown, or saved straight to the
              local knowledge base.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 min-h-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md font-mono text-[10px] uppercase tracking-wider border" style={{ backgroundColor: `${accent.hex}1a`, borderColor: `${accent.hex}44`, color: accent.hex }}>
                  {report.mode === "web" ? "web report" : "local report"}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {report.sources.length} source{report.sources.length === 1 ? "" : "s"}
                  {report.fallback ? " · offline fallback" : ""}
                  {report.usedModel ? " · local model" : ""}
                </span>
              </div>
              <div className="flex gap-2">
                <HUDButton variant="ghost" size="sm" className="text-slate-400" onClick={() => void download()} title="Download report (.md)">
                  <Download size={12} className="mr-1.5" /> .md
                </HUDButton>
                <HUDButton variant="ghost" size="sm" className="text-slate-400" onClick={() => void copyReport()} title="Copy report">
                  {copied ? <Check size={12} className="mr-1.5 text-emerald-400" /> : <Copy size={12} className="mr-1.5" />}
                  {copied ? "Copied" : "Copy"}
                </HUDButton>
              </div>
            </div>

            {report.fallback && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-400/15 bg-amber-950/10 text-[11px] text-slate-400">
                <Wand2 size={12} className="shrink-0 mt-0.5 text-amber-400" />
                <span>No internet detected — this report was built from the local knowledge base instead of the web.</span>
              </div>
            )}

            <div className="rounded-xl bg-navy-950/70 border border-slate-800 p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">Summary</div>
              <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{report.summary}</p>
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">Key findings</div>
              <ol className="flex flex-col gap-2">
                {report.keyFindings.length > 0 ? (
                  report.keyFindings.map((finding, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-cyan-400 font-mono mt-0.5 shrink-0">{index + 1}.</span>
                      <span className="min-w-0">{finding}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-slate-500">No clear findings extracted from the sources.</li>
                )}
              </ol>
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">Contradictions</div>
              {report.contradictions.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {report.contradictions.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs text-amber-300/90">
                      <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                      <span className="min-w-0">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">No conflicting claims detected.</p>
              )}
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">Sources</div>
              <ol className="flex flex-col gap-1.5">
                {report.sources.map((source) => (
                  <li key={source.index} className="flex items-start gap-2 text-xs">
                    <span className="text-slate-600 font-mono shrink-0 mt-0.5">[{source.index}]</span>
                    <span className="min-w-0">
                      <span className="text-slate-200">{source.title}</span>
                      {source.origin === "web" ? (
                        <>
                          {" "}
                          <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-cyan-400/80 hover:text-cyan-300 font-mono text-[10px]">
                            <ExternalLink size={9} /> open
                          </a>
                        </>
                      ) : (
                        <span className="text-slate-500 font-mono text-[10px]"> · {source.url}</span>
                      )}
                      {" — "}
                      <span className="text-slate-500">{source.snippet}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <Sparkles size={11} className="shrink-0" />
              <span>{brand.aiName} keeps research local-first — fetched pages stay in memory, never stored, and the Network policy gates web access.</span>
            </div>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}