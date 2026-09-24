"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/context/BrandContext";
import { HUDButton } from "@/components/ui/HUDButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { AppWindow, Camera, Eye, Image as ImageIcon, Loader2, Monitor } from "lucide-react";
import type { ForegroundWindow, ScreenSnapshot } from "@/lib/screen";
import type { ImageInspection } from "@/types";

interface ScreenStatus {
  foreground: ForegroundWindow | null;
  lastSnapshot: ScreenSnapshot | null;
}

export function ScreenPanel() {
  const { brand, accent } = useBrand();
  const [status, setStatus] = useState<ScreenStatus | null>(null);
  const [snapshot, setSnapshot] = useState<ScreenSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheKey, setCacheKey] = useState(0);

  const activeSnapshot = snapshot ?? status?.lastSnapshot ?? null;
  const inspection: ImageInspection | null = activeSnapshot?.inspection ?? null;

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/screen/status", { cache: "no-store" });
      if (!response.ok) throw new Error(`Status failed (${response.status})`);
      const data = (await response.json()) as ScreenStatus;
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read screen status");
    }
  }, []);

  const capture = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/screen/capture", { method: "POST", cache: "no-store" });
      if (!response.ok) throw new Error(`Capture failed (${response.status})`);
      const data = (await response.json()) as ScreenSnapshot;
      if (!data.saved) throw new Error(data.error || "Capture produced no image");
      setSnapshot(data);
      setCacheKey(Date.now());
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not capture the screen");
    } finally {
      setBusy(false);
    }
  }, [loadStatus]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadStatus();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadStatus]);

  const fmtBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
  };

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      {/* Left: active window + capture */}
      <GlassPanel className="lg:col-span-2 flex flex-col p-5 gap-4 border-cyan-400/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-navy-950 border flex items-center justify-center" style={{ borderColor: `${accent.hex}4d`, color: accent.hex, boxShadow: `0 0 16px ${accent.hex}33` }}>
            <Monitor size={17} />
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: accent.hex }}>Screen Awareness</div>
            <h3 className="font-display font-medium text-slate-100 text-lg tracking-wide">What am I looking at?</h3>
          </div>
        </div>

        <div className="rounded-xl bg-navy-950/70 border border-slate-800 p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
            <AppWindow size={11} /> Active window
          </div>
          {status?.foreground ? (
            <>
              <p className="text-sm text-slate-200 font-mono break-words leading-snug">{status.foreground.title}</p>
              <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500">
                <span className="px-2 py-0.5 rounded border border-slate-700 text-slate-400">{status.foreground.process ?? "unknown"}</span>
                {status.foreground.pid !== null && <span>pid {status.foreground.pid}</span>}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500">Reading the foreground window…</p>
          )}
        </div>

        <HUDButton variant="default" size="sm" className="self-start" onClick={() => void capture()} disabled={busy}>
          {busy ? <Loader2 size={13} className="animate-spin mr-2" /> : <Camera size={13} className="mr-2" />}
          Capture screen
        </HUDButton>

        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg border border-red-500/20 bg-red-950/20 text-xs text-red-300">
            <span className="min-w-0">{error}</span>
          </div>
        )}

        <div className="flex items-start gap-2 p-2.5 rounded-lg border border-cyan-400/10 bg-cyan-950/10 text-[11px] text-slate-400">
          <Eye size={12} className="shrink-0 mt-0.5 text-cyan-400" />
          <span>
            {brand.aiName} sees structure today: the active window plus pixel stats. Describing what&apos;s on screen
            needs an offline vision model (Ollama + <code className="font-mono text-cyan-400">llava</code>) — TECHY pipes
            this PNG through the moment one is present. Everything stays on this machine.
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <Monitor size={11} className="shrink-0" />
          <span>Capture is local-only — the PNG lives at <code className="font-mono">data/screen/last.png</code>.</span>
        </div>
      </GlassPanel>

      {/* Right: snapshot */}
      <GlassPanel className="lg:col-span-3 flex flex-col p-5 gap-4 border-cyan-400/20 min-h-[420px]">
        {!activeSnapshot ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-600 py-10 text-center">
            <div className="w-14 h-14 rounded-xl bg-navy-950 border border-slate-800 flex items-center justify-center text-slate-600">
              <ImageIcon size={22} />
            </div>
            <p className="font-mono text-xs">No snapshot yet</p>
            <p className="text-[11px] text-slate-600 max-w-sm">
              Hit Capture screen to grab the primary display — TECHY reads dimensions and palette, and stores the frame
              locally for the vision step.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 min-h-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md font-mono text-[10px] uppercase tracking-wider border" style={{ backgroundColor: `${accent.hex}1a`, borderColor: `${accent.hex}44`, color: accent.hex }}>
                  {activeSnapshot.width}×{activeSnapshot.height}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {inspection?.format ?? "png"} · {fmtBytes(activeSnapshot.bytes)} · {new Date(activeSnapshot.at).toLocaleTimeString()}
                </span>
              </div>
              {activeSnapshot.error && (
                <span className="text-[10px] font-mono text-red-400">capture failed</span>
              )}
            </div>

            <div className="rounded-xl bg-navy-950/70 border border-slate-800 overflow-hidden flex-1 min-h-0 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={cacheKey}
                src={`/api/files/media?path=${encodeURIComponent("data/screen/last.png")}&t=${cacheKey}`}
                alt="Screen snapshot"
                className="absolute inset-0 w-full h-full object-contain bg-black/60"
              />
            </div>

            {inspection && inspection.palette.length > 0 && (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">Palette</div>
                <div className="flex flex-wrap gap-2">
                  {inspection.palette.map((entry) => (
                    <span key={entry.hex} className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-800 bg-navy-950/70 text-[10px] font-mono text-slate-400">
                      <span className="w-3 h-3 rounded-sm border border-slate-700" style={{ backgroundColor: entry.hex }} />
                      {entry.hex} · {entry.share}%
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
