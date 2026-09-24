"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/context/BrandContext";
import { HUDButton } from "@/components/ui/HUDButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  AlertCircle,
  AudioLines,
  CheckSquare,
  History,
  Loader2,
  ListChecks,
  Mic2,
  Trash2,
  Users,
  Wand2,
} from "lucide-react";
import type { AudioTranscriptEntry } from "@/types";
import type { AudioIntelligenceResult } from "@/lib/audio";

export function AudioIntelPanel() {
  const { brand, accent } = useBrand();
  const [name, setName] = useState("");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<AudioIntelligenceResult | null>(null);
  const [history, setHistory] = useState<AudioTranscriptEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/audio/transcripts", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { transcripts: AudioTranscriptEntry[] };
        setHistory(data.transcripts);
      }
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void loadHistory());
    return () => cancelAnimationFrame(frame);
  }, [loadHistory]);

  const processText = useCallback(async () => {
    const value = transcript.trim();
    if (value.length < 20) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/audio/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || undefined, transcript: value }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? `Failed (${response.status})`);
      }
      const data = (await response.json()) as { result: AudioIntelligenceResult };
      setResult(data.result);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not analyze transcript");
    } finally {
      setBusy(false);
    }
  }, [transcript, name, loadHistory]);

  const removeEntry = useCallback(async (id: string) => {
    await fetch(`/api/audio/transcripts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setHistory((current) => current.filter((entry) => entry.id !== id));
  }, []);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
      {/* Input */}
      <GlassPanel className="xl:col-span-2 p-5 flex flex-col gap-4 border-cyan-400/20 h-fit xl:sticky xl:top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-navy-950 border flex items-center justify-center" style={{ borderColor: `${accent.hex}4d`, color: accent.hex, boxShadow: `0 0 16px ${accent.hex}33` }}>
            <AudioLines size={17} />
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: accent.hex }}>Audio Intelligence</div>
            <h3 className="font-display font-medium text-slate-100 text-lg tracking-wide">Analyze a recording</h3>
          </div>
        </div>

        <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Product call — Sep 24"
            className="mt-1 w-full rounded-lg bg-navy-950/70 border border-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/50" />
        </label>

        <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
          Transcript *
          <textarea
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            placeholder={"Paste a transcript. Example:\n\nSpeaker 1: We need to ship the redesign by Friday.\nSpeaker 2: Agreed — I will update the handoff tonight.\nSpeaker 1: Send the client the new pricing before we meet."}
            className="mt-1 w-full h-52 resize-none rounded-xl bg-navy-950/70 border border-slate-800 text-sm text-slate-200 placeholder:text-slate-600 p-3 font-mono focus:outline-none focus:border-cyan-400/50"
          />
        </label>

        <HUDButton variant="default" onClick={() => void processText()} disabled={transcript.trim().length < 20 || busy}>
          {busy ? <Loader2 size={13} className="animate-spin mr-2" /> : <Wand2 size={13} className="mr-2" />}
          {busy ? "Separating speakers…" : "Analyze transcript"}
        </HUDButton>

        <div className="flex items-start gap-2 p-2.5 rounded-lg border border-slate-800 bg-navy-950/40 text-[11px] text-slate-500 leading-relaxed">
          <Mic2 size={12} className="shrink-0 mt-0.5" />
          <span>
            {brand.aiName} separates speakers, builds an extractive summary and pulls out action items — all offline and
            deterministic. For live dictation, speak to TECHY in <span className="text-cyan-400">Chat</span> and paste the result here.
          </span>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg border border-red-500/20 bg-red-950/20 text-xs text-red-300">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span className="min-w-0">{error}</span>
          </div>
        )}
      </GlassPanel>

      {/* Result */}
      <div className="xl:col-span-3 flex flex-col gap-4 min-w-0">
        {result ? (
          <GlassPanel className="p-5 flex flex-col gap-4 border-cyan-400/20">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md font-mono text-[10px] uppercase tracking-wider border" style={{ backgroundColor: `${accent.hex}1a`, borderColor: `${accent.hex}44`, color: accent.hex }}>
                  {result.speakerCount} speaker{result.speakerCount === 1 ? "" : "s"}
                </span>
                <span className="text-[11px] font-mono text-slate-500">{result.blocks.length} passages analyzed</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                <CheckSquare size={11} className="text-cyan-400" /> Summary
              </div>
              <p className="rounded-xl bg-navy-950/70 border border-slate-800 p-4 text-xs text-slate-300 leading-relaxed">{result.summary}</p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                <ListChecks size={11} className="text-emerald-400" /> Action items
              </div>
              {result.actionItems.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {result.actionItems.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs text-slate-300 rounded-lg bg-navy-950/50 border border-slate-800/70 px-3 py-2">
                      <span className="text-emerald-400 mt-0.5 shrink-0">→</span>
                      <span className="min-w-0">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">No clear action items detected.</p>
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                <Users size={11} className="text-violet-400" /> Speakers
              </div>
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                {result.blocks.map((block, index) => (
                  <div key={index} className="flex gap-3 text-xs">
                    <span
                      className="shrink-0 text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-md h-fit border"
                      style={{ color: accent.hex, borderColor: `${accent.hex}44`, backgroundColor: `${accent.hex}14` }}
                    >
                      {block.speaker}
                    </span>
                    <span className="text-slate-400 leading-relaxed min-w-0">{block.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassPanel>
        ) : (
          <GlassPanel className="p-8 flex flex-col items-center justify-center gap-3 text-center text-slate-600 min-h-64">
            <div className="w-14 h-14 rounded-xl bg-navy-950 border border-slate-800 flex items-center justify-center">
              <AudioLines size={22} />
            </div>
            <p className="font-mono text-xs">Analysis will appear here</p>
            <p className="text-[11px] text-slate-600 max-w-sm">Transcript → speakers → summary → action items. Everything is processed locally.</p>
          </GlassPanel>
        )}

        {/* History */}
        <GlassPanel className="p-5 flex flex-col gap-3 border-slate-800">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500">
            <History size={11} className="text-cyan-400" /> {history.length} saved analysis{history.length === 1 ? "" : "ies"}
          </div>
          {history.length === 0 && <p className="text-xs text-slate-500">No saved transcripts yet.</p>}
          <div className="flex flex-col gap-2">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 rounded-lg bg-navy-950/50 border border-slate-800/70 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setTranscript(entry.transcript);
                    setName(entry.name);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="text-left flex-1 min-w-0"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-slate-200 truncate">{entry.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">{entry.speakers} speakers</span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{entry.summary}</p>
                </button>
                <HUDButton variant="ghost" size="sm" className="text-red-400 shrink-0" onClick={() => void removeEntry(entry.id)}>
                  <Trash2 size={13} />
                </HUDButton>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}