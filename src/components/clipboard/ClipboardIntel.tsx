"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useBrand } from "@/context/BrandContext";
import { HUDButton } from "@/components/ui/HUDButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  Check,
  Clipboard,
  Copy,
  FileText,
  Keyboard,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  TextCursorInput,
  Wand2,
  X,
} from "lucide-react";
import {
  describeDetection,
  type ClipboardAction,
  type ClipboardIntel,
} from "@/lib/clipboard";
import { takePendingText } from "@/lib/intake";

interface ActResult {
  available: boolean;
  offline: boolean;
  action: ClipboardAction;
  kind: string;
  reply: string | null;
}

export function ClipboardIntel() {
  const { brand, accent } = useBrand();
  const searchParams = useSearchParams();
  const [clipped, setClipped] = useState<string>("");
  const [intel, setIntel] = useState<ClipboardIntel | null>(null);
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<ClipboardAction | null>(null);
  const [result, setResult] = useState<ActResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [readHint, setReadHint] = useState(false);
  const usedPendingRef = useRef(false);

  const activeText = (intel?.sample ?? clipped).trim();

  const analyze = useCallback(async (text: string) => {
    const value = text.trim();
    setError(null);
    if (!value) {
      setIntel(null);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/clipboard/intel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Intel request failed (${response.status})`);
      const data = (await response.json()) as ClipboardIntel;
      setClipped(value);
      setIntel(data);
      setResult(null);
      setSaved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not analyze the clipboard");
    } finally {
      setLoading(false);
    }
  }, []);

  const readClipboard = useCallback(async () => {
    setReading(true);
    setError(null);
    setReadHint(false);
    try {
      if (!navigator.clipboard?.readText) throw new Error("Clipboard API not available");
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setReadHint(true);
      } else {
        await analyze(text);
      }
    } catch {
      setReadHint(true);
      setError("Clipboard access needs this tab focused and permission. Paste below instead.");
    } finally {
      setReading(false);
    }
  }, [analyze]);

  const runAction = useCallback(async (action: ClipboardAction) => {
    if (!activeText) return;
    setActing(action);
    setResult(null);
    setError(null);
    try {
      const response = await fetch("/api/clipboard/act", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: activeText, action }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Action failed (${response.status})`);
      const data = (await response.json()) as ActResult;
      setResult(data);
      if (data.action === "save") setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run that action");
    } finally {
      setActing(null);
    }
  }, [activeText]);

  const save = useCallback(async () => {
    if (!activeText) return;
    setSaved(false);
    setError(null);
    try {
      const response = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: activeText.slice(0, 1200), source: "clipboard" }),
        cache: "no-store",
      });
      if (response.status === 409) throw new Error("TECHY already remembers this");
      if (!response.ok) throw new Error(`Save failed (${response.status})`);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save to memory");
    }
  }, [activeText]);

  const copyResult = useCallback(async () => {
    if (!result?.reply) return;
    try {
      await navigator.clipboard.writeText(result.reply);
    } catch {
      setError("Could not copy — this tab needs focus.");
    }
  }, [result]);

  const acceptPending = useCallback(() => {
    const pending = takePendingText();
    if (pending.trim()) void analyze(pending);
  }, [analyze]);

  useEffect(() => {
    if (usedPendingRef.current) return;
    usedPendingRef.current = true;
    const frame = requestAnimationFrame(() => {
      if (searchParams.get("from") === "drop") {
        acceptPending();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [searchParams, acceptPending]);

  useEffect(() => {
    const onDroppedText = (event: Event) => {
      const detail = (event as CustomEvent).detail as { text?: string } | undefined;
      if (detail?.text) void analyze(detail.text);
    };
    window.addEventListener("techy:droptext", onDroppedText);
    return () => window.removeEventListener("techy:droptext", onDroppedText);
  }, [analyze]);

  const modelConnected = result?.available === true && result.offline === false;

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      {/* Left: source + detection */}
      <GlassPanel className="lg:col-span-2 flex flex-col p-5 gap-4 border-cyan-400/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-navy-950 border flex items-center justify-center" style={{ borderColor: `${accent.hex}4d`, color: accent.hex, boxShadow: `0 0 16px ${accent.hex}33` }}>
            <Clipboard size={17} />
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: accent.hex }}>Clipboard Intelligence</div>
            <h3 className="font-display font-medium text-slate-100 text-lg tracking-wide">What&apos;s on your clipboard?</h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <HUDButton variant="default" size="sm" className="shrink-0" onClick={() => void readClipboard()} disabled={reading || loading}>
            {reading ? <Loader2 size={13} className="animate-spin mr-2" /> : <RefreshCw size={13} className="mr-2" />}
            Read clipboard
          </HUDButton>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <TextCursorInput size={11} className="shrink-0" />
          <span>or paste manually below</span>
        </div>

        <textarea
          value={clipped}
          onChange={(event) => {
            const value = event.target.value;
            setClipped(value);
            setIntel(null);
            setResult(null);
            if (!value.trim()) setError(null);
          }}
          placeholder="Paste anything — a paragraph, URL, code, table, email…"
          className="w-full h-40 resize-none rounded-xl bg-navy-950/70 border border-slate-800 text-sm text-slate-200 placeholder:text-slate-600 p-3 font-mono focus:outline-none focus:border-cyan-400/50"
        />

        <div className="flex gap-2">
          <HUDButton variant="outline" size="sm" className="text-slate-300" onClick={() => void analyze(clipped)} disabled={!clipped.trim() || loading}>
            Analyze
          </HUDButton>
          <HUDButton variant="ghost" size="sm" className="text-slate-500" onClick={() => { setClipped(""); setIntel(null); setResult(null); setError(null); setSaved(false); }} disabled={!clipped && !intel}>
            Clear
          </HUDButton>
        </div>

        {readHint && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg border border-slate-800/70 bg-navy-950/50 text-[11px] text-slate-400">
            <Keyboard size={12} className="shrink-0 mt-0.5" />
            <span>{brand.aiName} needs this tab focused to peek at the system clipboard. For true global access, run <code className="font-mono text-cyan-400">desktop/techy-launcher.bat</code> — Ctrl+Space works above any app.</span>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-red-500/20 bg-red-950/20 text-xs text-red-300">
            <span className="min-w-0">{error}</span>
            <button className="text-red-400 shrink-0" onClick={() => setError(null)} aria-label="Dismiss error">
              <X size={12} />
            </button>
          </div>
        )}

        <div className="flex items-start gap-2 p-2.5 rounded-lg border border-cyan-400/10 bg-cyan-950/10 text-[11px] text-slate-400">
          <Wand2 size={12} className="shrink-0 mt-0.5 text-cyan-400" />
          <span>Launch <code className="font-mono text-cyan-400">desktop/TechyLauncher.ps1</code> to get a desktop overlay that watches the clipboard and talks to this page over <code className="font-mono text-cyan-400">/api/clipboard/*</code>.</span>
        </div>
      </GlassPanel>

      {/* Right: detection + actions */}
      <GlassPanel className="lg:col-span-3 flex flex-col p-5 gap-4 border-cyan-400/20 min-h-[420px]">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 size={22} className="animate-spin text-cyan-400" />
            <span className="font-mono text-xs">Scanning clipboard…</span>
          </div>
        ) : !intel ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center text-slate-600 py-10">
            <div className="w-14 h-14 rounded-xl bg-navy-950 border border-slate-800 flex items-center justify-center text-slate-600">
              <Sparkles size={22} />
            </div>
            <p className="font-mono text-xs">Clipboard will be detected here</p>
            <p className="text-[11px] text-slate-600 max-w-sm">
              Copy a URL, an image, code, a table, addresses, emails or phone numbers, then hit Read clipboard.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md font-mono text-[10px] uppercase tracking-wider border" style={{ backgroundColor: `${accent.hex}1a`, borderColor: `${accent.hex}44`, color: accent.hex }}>
                  {intel.label}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {intel.charCount} chars · {intel.wordCount} words
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ backgroundColor: accent.hex }} />
                <span className="relative inline-flex rounded-full w-2 h-2" style={{ backgroundColor: accent.hex }} />
              </span>
                detected
              </div>
            </div>

            <p className="text-[11px] font-mono" style={{ color: `${accent.hex}cc` }}>{describeDetection(intel)}</p>

            <div className="rounded-xl bg-navy-950/70 border border-slate-800 p-3 flex-1 min-h-0 overflow-y-auto">
              <div className="flex items-center gap-1.5 mb-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                <FileText size={10} /> Preview
              </div>
              <p className="text-xs text-slate-400 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">{intel.preview}</p>
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">TECHY can…</div>
              <div className="flex flex-wrap gap-2">
                {intel.actions.map((action) => (
                  <HUDButton
                    key={action}
                    variant="outline"
                    size="sm"
                    className="border-cyan-400/30 text-cyan-400 hover:bg-cyan-950/30 capitalize"
                    onClick={() => void runAction(action)}
                    disabled={acting !== null}
                  >
                    {acting === action ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Wand2 size={12} className="mr-1.5" />}
                    {action}
                  </HUDButton>
                ))}
                <HUDButton
                  variant="ghost"
                  size="sm"
                  className="text-amber-400 hover:bg-amber-950/20 border border-amber-400/20"
                  onClick={() => void save()}
                  disabled={acting !== null}
                >
                  {saved ? <Check size={12} className="mr-1.5" /> : <Save size={12} className="mr-1.5" />}
                  {saved ? "Saved" : "Save"}
                </HUDButton>
              </div>
            </div>

            {result && (
              <div className="rounded-xl border p-3 flex flex-col gap-2" style={{ borderColor: result.offline ? `${accent.hex}33` : "rgba(34,197,94,0.3)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider">
                    <span style={{ color: result.offline ? accent.hex : "#34d399" }}>
                      {result.offline ? "Offline result" : `${brand.aiName} · local model`}
                    </span>
                    <span className="text-slate-600">{modelConnected ? "connected" : "fallback"}</span>
                  </div>
                  {result.reply && (
                    <HUDButton variant="ghost" size="sm" className="h-6 px-2 text-slate-400" onClick={() => void copyResult()} title="Copy result">
                      <Copy size={12} className="mr-1.5" />
                      Copy
                    </HUDButton>
                  )}
                </div>
                <p className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed max-h-56 overflow-y-auto">
                  {result.reply ?? (acting ? "Working…" : "This action needs a local AI model — start Ollama (localhost:11434) or run it from chat.")}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <Clipboard size={11} className="shrink-0" />
              <span>Only {brand.aiName}&apos;s action result gets written back to the clipboard — never your raw clipboard content.</span>
            </div>
          </>
        )}
      </GlassPanel>
    </div>
  );
}