"use client";

import { useCallback, useMemo, useState } from "react";
import { File as FileIcon, Folder, ExternalLink, AlertTriangle, Loader2, Check } from "lucide-react";

interface ParsedPath {
  path: string;
  name: string;
  isDirectory: boolean;
}

export type FileActionKind = "summarize" | "analyze";

const WINDOWS_PATH = /[A-Za-z]:[\\/][^\s'"<>|?*,;]+(?:\.[A-Za-z0-9]{1,6})?(?=$|[\s,;)\]}\."'!?])/g;
const POSIX_PATH = /\/(?:[^\s'"<>|*]+\/)+[^\s'"<>|*]+/g;

function extractPaths(content: string): ParsedPath[] {
  const candidates = new Set<string>();
  for (const match of content.matchAll(WINDOWS_PATH)) {
    candidates.add(match[0].replace(/[",;)\]}.]$/, ""));
  }
  for (const match of content.matchAll(POSIX_PATH)) {
    candidates.add(match[0].replace(/[",;)\]}.]$/, ""));
  }
  return Array.from(candidates)
    .slice(0, 4)
    .map((path) => {
      const segments = path.split(/[\\/]/);
      const name = segments[segments.length - 1] ?? path;
      const isDirectory = !name.includes(".");
      return { path, name, isDirectory };
    })
    .filter((entry) => entry.name.length > 0)
    .filter((entry) => {
      const lower = entry.name.toLowerCase();
      return !lower.includes("http") && !lower.startsWith("www.");
    })
    .filter((entry) => entry.isDirectory || /\.\w{1,8}$/.test(entry.name));
}

function Glyph({ isDirectory }: { isDirectory: boolean }) {
  return isDirectory ? (
    <Folder size={20} className="text-amber-400" />
  ) : (
    <FileIcon size={20} className="text-blue-400" />
  );
}

export function FileActionCards({ content, onAction }: { content: string; onAction?: (path: string, action: FileActionKind) => void }) {
  const paths = useMemo(() => extractPaths(content), [content]);
  if (paths.length === 0) return null;

  return (
    <div className="mt-2 space-y-2 w-full max-w-md">
      {paths.map((entry) => (
        <FileActionCard key={entry.path} entry={entry} onAction={onAction} />
      ))}
    </div>
  );
}

function FileActionCard({ entry, onAction }: { entry: ParsedPath; onAction?: (path: string, action: FileActionKind) => void }) {
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(async () => {
    setOpening(true);
    setError(null);
    try {
      const response = await fetch("/api/files/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: entry.path }),
        cache: "no-store",
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
      setOpened(true);
      setTimeout(() => setOpened(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open");
      setTimeout(() => setError(null), 4000);
    } finally {
      setOpening(false);
    }
  }, [entry.path]);

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-cyan-400/20 bg-cyan-950/10 hover:bg-cyan-950/20 transition-colors">
      <Glyph isDirectory={entry.isDirectory} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-200 truncate">{entry.name}</p>
        <p className="text-[10px] font-mono text-slate-500 truncate">{entry.path}</p>
      </div>
      {error ? (
        <span className="flex items-center gap-1 text-[10px] text-rose-400 shrink-0">
          <AlertTriangle size={11} />
          {error}
        </span>
      ) : (
        <>
          {onAction && !entry.isDirectory && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onAction(entry.path, "summarize")}
                className="px-2 py-1 rounded-md text-[11px] font-mono text-violet-400 bg-violet-500/10 border border-violet-400/25 hover:bg-violet-500/20 transition-colors"
              >
                Summarize
              </button>
              <button
                onClick={() => onAction(entry.path, "analyze")}
                className="px-2 py-1 rounded-md text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-400/25 hover:bg-amber-500/20 transition-colors"
              >
                Analyze
              </button>
            </div>
          )}
          <button
            onClick={open}
            disabled={opening}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-400/25 hover:bg-cyan-500/20 transition-colors shrink-0 disabled:opacity-60"
          >
            {opening ? (
              <Loader2 size={11} className="animate-spin" />
            ) : opened ? (
              <Check size={11} className="text-emerald-400" />
            ) : (
              <ExternalLink size={11} />
            )}
            {opening ? "Opening…" : opened ? "Opened" : "Open"}
          </button>
        </>
      )}
    </div>
  );
}