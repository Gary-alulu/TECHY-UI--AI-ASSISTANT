"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/context/BrandContext";
import { HUDButton } from "@/components/ui/HUDButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Film, FolderSearch, Loader2, Music, Mic, PlayCircle } from "lucide-react";
import type { MediaEntry, MediaKind } from "@/types";
import { cn } from "@/lib/utils";

const KIND_META: Record<MediaKind, { label: string; icon: React.ReactNode }> = {
  music: { label: "Music", icon: <Music size={14} /> },
  video: { label: "Video", icon: <Film size={14} /> },
  podcast: { label: "Podcasts", icon: <Mic size={14} /> },
  audio: { label: "Audio", icon: <PlayCircle size={14} /> },
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatShortDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MediaCenterPanel() {
  const { accent } = useBrand();
  const [media, setMedia] = useState<MediaEntry[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [totalBytes, setTotalBytes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | MediaKind>("all");
  const [nowPlaying, setNowPlaying] = useState<MediaEntry | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/media", { cache: "no-store" });
      if (!response.ok) throw new Error(`Failed (${response.status})`);
      const data = (await response.json()) as { media: MediaEntry[]; counts: Record<string, number>; totalBytes: number };
      setMedia(data.media);
      setCounts(data.counts);
      setTotalBytes(data.totalBytes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not scan media");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const visible = filter === "all" ? media : media.filter((entry) => entry.kind === filter);
  const isVideo = nowPlaying?.kind === "video";

  return (
    <div className="flex flex-col gap-5">
      {/* Now playing */}
      {nowPlaying && (
        <GlassPanel className="p-5 border-cyan-400/20 flex flex-col gap-3" hudCorners>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: accent.hex }}>
                {KIND_META[nowPlaying.kind].label}
              </div>
              <div className="font-display font-medium text-slate-100 tracking-wide truncate">{nowPlaying.name}</div>
            </div>
            <HUDButton variant="ghost" size="sm" className="text-slate-400" onClick={() => setNowPlaying(null)}>
              Close
            </HUDButton>
          </div>
          {isVideo ? (
            <video key={`${nowPlaying.id}-${nowPlaying.modifiedAt ?? ""}`} controls className="w-full max-h-96 rounded-lg bg-black border border-slate-800"
              src={`/api/media/file?path=${encodeURIComponent(nowPlaying.path)}`} />
          ) : (
            <audio key={`${nowPlaying.id}-${nowPlaying.modifiedAt ?? ""}`} controls className="w-full"
              src={`/api/media/file?path=${encodeURIComponent(nowPlaying.path)}`} />
          )}
        </GlassPanel>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <HUDButton variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
          <FolderSearch size={12} className="mr-1.5" /> All
          <span className="ml-1.5 font-mono text-[10px] opacity-70">{media.length}</span>
        </HUDButton>
        {(Object.keys(KIND_META) as MediaKind[]).map((kind) => (
          <HUDButton key={kind} variant={filter === kind ? "default" : "outline"} size="sm"
            className={filter === kind ? (kind === "video" ? "border-violet-400/50 text-violet-300" : kind === "music" ? "border-cyan-400/50 text-cyan-300" : kind === "podcast" ? "border-amber-400/50 text-amber-300" : "") : "text-slate-400"}
            onClick={() => setFilter(kind)}>
            {KIND_META[kind].icon}
            <span className="ml-1">{KIND_META[kind].label}</span>
            <span className="ml-1.5 font-mono text-[10px] opacity-70">{counts[kind] ?? 0}</span>
          </HUDButton>
        ))}
        <div className="ml-auto flex items-center gap-2 text-[11px] font-mono text-slate-500">
          {formatBytes(totalBytes)} discovered · scans your Music, Videos &amp; media folders
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-400/20 bg-amber-950/15 text-xs text-amber-300">
          <span className="min-w-0">{error} — some folders may be unavailable, showing what was readable.</span>
        </div>
      )}

      {loading && (
        <GlassPanel className="p-8 flex items-center justify-center text-slate-500">
          <Loader2 size={20} className="animate-spin text-cyan-400 mr-3" />
          <span className="font-mono text-xs">Scanning local media…</span>
        </GlassPanel>
      )}

      {/* Grid */}
      {!loading && visible.length === 0 && (
        <GlassPanel className="p-8 flex flex-col items-center justify-center gap-2 text-center text-slate-600">
          <div className="w-14 h-14 rounded-xl bg-navy-950 border border-slate-800 flex items-center justify-center">
            <Music size={22} />
          </div>
          <p className="font-mono text-xs">No {filter === "all" ? "media" : filter} found</p>
          <p className="text-[11px] text-slate-600 max-w-sm">Drop music or videos into your <span className="font-mono text-cyan-400">Music</span>, <span className="font-mono text-cyan-400">Videos</span> or <span className="font-mono text-cyan-400">/media</span> folder and they will appear here.</p>
        </GlassPanel>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {visible.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setNowPlaying(entry)}
            className={cn(
              "text-left rounded-xl bg-navy-950/60 border p-4 flex flex-col gap-3 transition-all hover:border-cyan-400/30 group cursor-pointer",
              nowPlaying?.id === entry.id ? "border-cyan-400/40 shadow-[0_0_20px_rgba(34,211,238,0.08)]" : "border-slate-800"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-lg bg-navy-950 border border-slate-800 flex items-center justify-center" style={{ color: accent.hex }}>
                {KIND_META[entry.kind].icon}
              </div>
              <PlayCircle size={18} className="text-slate-700 group-hover:text-cyan-400 transition-colors" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-200 truncate">{entry.name}</div>
              <div className="text-[10px] font-mono text-slate-500 mt-0.5 flex items-center gap-2">
                <span className="uppercase tracking-wider text-slate-600">{KIND_META[entry.kind].label}</span>
                <span>·</span>
                <span>{formatBytes(entry.sizeBytes)}</span>
                {entry.modifiedAt && <><span>·</span><span>{formatShortDate(entry.modifiedAt)}</span></>}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}