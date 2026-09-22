"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GlassPanel } from "../ui/GlassPanel";
import {
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Cpu,
  ExternalLink,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  Folder as FolderIcon,
  FolderOpen,
  HardDrive,
  Home,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  SearchX,
  Sparkles,
  Star,
  Wand2,
  X,
} from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import type { FileEntry } from "@/types";

type Scope = "system" | "device";

interface Listing {
  scope: Scope;
  root: string;
  path: string;
  name: string;
  parent: string | null;
  roots: string[];
  entries: FileEntry[];
  truncated: boolean;
}

interface Favorite {
  path: string;
  name: string;
  kind: "file" | "directory";
  addedAt: string;
}

interface Recent {
  path: string;
  name: string;
  kind: "file" | "directory";
  size?: number;
  openedAt: string;
}

interface SearchHit {
  path: string;
  name: string;
  type: "file" | "directory";
  size?: number;
  modifiedAt?: string;
  matched: "name" | "content";
}

interface PreviewData {
  kind: string;
  name: string;
  size: number;
  extension?: string;
  modifiedAt?: string;
  text?: string;
  truncated?: boolean;
  note?: string;
}

interface Crumb {
  label: string;
  path: string;
}

type TypeFilter = "all" | "docs" | "code" | "image" | "video" | "audio" | "archive" | "sheet";
type SortKey = "name" | "size" | "date";
type SortDir = "asc" | "desc";

const TYPE_OPTIONS: Array<{ key: TypeFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "docs", label: "Docs" },
  { key: "code", label: "Code" },
  { key: "image", label: "Images" },
  { key: "sheet", label: "Sheets" },
  { key: "video", label: "Video" },
  { key: "audio", label: "Audio" },
  { key: "archive", label: "Archives" },
];

function fileKind(extension?: string): string {
  switch (extension) {
    case "zip": case "rar": case "7z": case "tar": case "gz": case "bz2": return "archive";
    case "png": case "jpg": case "jpeg": case "gif": case "webp": case "svg": case "ico": case "bmp": case "avif": return "image";
    case "mp4": case "mov": case "avi": case "mkv": case "webm": return "video";
    case "mp3": case "wav": case "flac": case "ogg": case "m4a": return "audio";
    case "pdf": case "docx": case "doc": case "txt": case "md": case "markdown": case "mdx": case "rtf": case "odt": return "docs";
    case "xlsx": case "xls": case "csv": case "xlsm": return "sheet";
    case "ts": case "tsx": case "js": case "jsx": case "mjs": case "cjs": case "json": case "css": case "scss": case "html": case "htm":
    case "py": case "go": case "rs": case "java": case "c": case "cpp": case "h": case "hpp": case "sh": case "bash": case "ps1":
    case "yml": case "yaml": case "toml": case "xml": case "sql": case "ini": case "env": case "config": return "code";
    default: return "text";
  }
}

function entryType(entry: FileEntry): string {
  if (entry.type === "directory") return "folder";
  return fileKind(entry.extension);
}

function matchesFilter(entry: FileEntry, filter: TypeFilter): boolean {
  if (filter === "all" || entry.type === "directory") return true;
  return entryType(entry) === filter;
}

function formatDate(value?: Date | string): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function relativePath(from: string, dir: string): string {
  const trimmed = from.startsWith(dir) ? from.slice(dir.length) : from;
  return trimmed.replace(/^[\\/]+/, "");
}

function buildCrumbs(listing: Listing): Crumb[] {
  if (listing.scope === "system") {
    const crumbs: Crumb[] = [{ label: "Workspace", path: listing.root }];
    const rel = relativePath(listing.path, listing.root);
    let acc = listing.root;
    for (const segment of rel.split(/[\\/]/).filter(Boolean)) {
      acc = `${acc}\\${segment}`;
      crumbs.push({ label: segment, path: acc });
    }
    return crumbs;
  }
  if (!listing.root) return [{ label: "This PC", path: "" }];
  const crumbs: Crumb[] = [
    { label: "This PC", path: "" },
    { label: listing.root.replace(/[\\/]+$/, ""), path: listing.root },
  ];
  const rel = relativePath(listing.path, listing.root);
  let acc = listing.root;
  for (const segment of rel.split(/[\\/]/).filter(Boolean)) {
    acc = acc.endsWith("\\") || acc.endsWith("/") ? acc + segment : `${acc}\\${segment}`;
    crumbs.push({ label: segment, path: acc });
  }
  return crumbs;
}

function FileGlyph({ entry }: { entry: FileEntry }) {
  if (entry.type === "directory") return <FolderOpen size={32} className="text-amber-400" />;
  switch (fileKind(entry.extension)) {
    case "code": return <FileCode size={32} className="text-emerald-400" />;
    case "image": return <FileImage size={32} className="text-violet-400" />;
    case "video": return <FileVideo size={32} className="text-rose-400" />;
    case "audio": return <FileAudio size={32} className="text-fuchsia-400" />;
    case "archive": return <FileArchive size={32} className="text-amber-300" />;
    case "docs": case "sheet": return <FileText size={32} className="text-blue-400" />;
    default: return <FileText size={32} className="text-slate-400" />;
  }
}

function csvRows(text: string, max = 60): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(0, max)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

export function FilesPanel() {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("system");
  const [listing, setListing] = useState<Listing | null>(null);
  const [roots, setRoots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [preview, setPreview] = useState<PreviewData | "loading" | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);

  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [recents, setRecents] = useState<Recent[]>([]);

  const [globalQuery, setGlobalQuery] = useState("");
  const [globalBusy, setGlobalBusy] = useState(false);
  const [globalHits, setGlobalHits] = useState<SearchHit[] | null>(null);

  const requestId = useRef(0);

  const load = useCallback(async (targetScope: Scope, target: string) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ path: target, scope: targetScope });
      const response = await fetch(`/api/files?${params.toString()}`, { cache: "no-store" });
      const data = (await response.json()) as Listing & { error?: string };
      if (!response.ok || data.error) throw new Error(data.error ?? `Request failed (${response.status})`);
      if (id !== requestId.current) return;
      setScope(data.scope);
      setListing(data);
      if (data.scope === "system" && data.parent === null) setRoots(data.roots);
      if (data.scope === "device" && data.root === "" && data.parent === null) setRoots(data.roots);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : "Failed to read directory");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  const loadSidecar = useCallback(async () => {
    try {
      const [favResponse, recentsResponse] = await Promise.all([
        fetch("/api/favorites", { cache: "no-store" }),
        fetch("/api/recents", { cache: "no-store" }),
      ]);
      if (favResponse.ok) {
        const favData = (await favResponse.json()) as { favorites: Favorite[] };
        setFavorites(favData.favorites ?? []);
      }
      if (recentsResponse.ok) {
        const recentsData = (await recentsResponse.json()) as { recents: Recent[] };
        setRecents(recentsData.recents ?? []);
      }
    } catch {
      // sidecar best-effort
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void load("system", "");
      void loadSidecar();
    });
    return () => cancelAnimationFrame(frame);
  }, [load, loadSidecar]);

  useEffect(() => {
    return () => {
      requestId.current += 1;
    };
  }, []);

  const switchScope = (next: Scope) => {
    if (next === scope || loading) return;
    setGlobalHits(null);
    setSelected(null);
    setPreview(null);
    load(next, "");
  };

  const navigateTo = useCallback(
    (entryPath: string) => {
      setSelected(null);
      setPreview(null);
      setGlobalHits(null);
      load(scope, entryPath);
    },
    [load, scope]
  );

  const goUp = () => {
    if (listing?.parent != null) load(scope, listing.parent);
  };

  const goHome = () => load(scope, "");

  const isFavorite = useCallback(
    (path: string) => favorites.some((entry) => entry.path.replace(/\\+$/, "") === path.replace(/\\+$/, "")),
    [favorites]
  );

  const toggleFavorite = useCallback(
    async (entry: FileEntry) => {
      const already = isFavorite(entry.path);
      const action = already ? "DELETE" : "POST";
      const body = already ? { path: entry.path } : { path: entry.path, name: entry.name, kind: entry.type };
      try {
        const response = await fetch("/api/favorites", {
          method: action,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { favorites: Favorite[] };
        setFavorites(data.favorites ?? []);
      } catch {
        // best effort
      }
    },
    [isFavorite]
  );

  const openEntry = useCallback(
    async (entry: FileEntry) => {
      try {
        await fetch("/api/files/open", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: entry.path }),
          cache: "no-store",
        });
      } catch {
        // best effort
      }
      setRecents((previous) => [
        { path: entry.path, name: entry.name, kind: entry.type, size: entry.size, openedAt: new Date().toISOString() },
        ...previous.filter((recent) => recent.path !== entry.path),
      ].slice(0, 20));
    },
    []
  );

  const selectEntry = useCallback(
    async (entry: FileEntry) => {
      if (entry.type === "directory") {
        navigateTo(entry.path);
        return;
      }
      setSelected(entry);
      setRenaming(false);
      setPreview("loading");
      try {
        const params = new URLSearchParams({ path: entry.path, scope });
        const response = await fetch(`/api/files/preview?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Preview failed (${response.status})`);
        const data = (await response.json()) as PreviewData;
        setPreview(data);
      } catch (err) {
        setPreview({ kind: "binary", name: entry.name, size: entry.size ?? 0, note: err instanceof Error ? err.message : "Preview unavailable" } as PreviewData);
      }
    },
    [navigateTo, scope]
  );

  const runGlobalSearch = useCallback(async () => {
    const needle = globalQuery.trim();
    if (!needle) {
      setGlobalHits(null);
      return;
    }
    setGlobalBusy(true);
    try {
      const response = await fetch("/api/files/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: needle,
          scope,
          ...(scope === "device" && listing?.root ? { root: listing.root } : {}),
        }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Search failed (${response.status})`);
      const data = (await response.json()) as { results: SearchHit[]; truncated: boolean };
      setGlobalHits(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setGlobalHits([]);
    } finally {
      setGlobalBusy(false);
    }
  }, [globalQuery, scope, listing]);

  const permuteSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    const base = (listing?.entries ?? []).filter((entry) => matchesFilter(entry, typeFilter));
    const dir = sortDir === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    let result = 0;
    if (sortKey === "name") {
      result = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    } else if (sortKey === "size") {
      result = (a.size ?? -1) - (b.size ?? -1);
    } else {
      const aTime = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
      const bTime = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;
      result = aTime - bTime;
    }
    return result * dir;
  });
}, [listing, typeFilter, sortKey, sortDir]);

  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of listing?.entries ?? []) {
      if (entry.type !== "file") continue;
      const key = `${entry.name.toLowerCase()}|${entry.size ?? ""}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  }, [listing]);

  const crumbs = useMemo(() => (listing ? buildCrumbs(listing) : []), [listing]);
  const atAnchor = listing?.parent == null;

  const startRename = () => {
    if (!selected) return;
    setRenameDraft(selected.name);
    setRenaming(true);
  };

  const submitRename = async () => {
    const newName = renameDraft.trim();
    if (!selected || !newName || newName === selected.name) {
      setRenaming(false);
      return;
    }
    setRenameBusy(true);
    try {
      const response = await fetch("/api/files/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selected.path, newName, scope }),
        cache: "no-store",
      });
      const data = (await response.json()) as { ok?: boolean; path?: string; name?: string; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Rename failed");
      setSelected({ ...selected, name: data.name ?? newName, path: data.path ?? `${selected.path}${newName}` });
      setRenaming(false);
      await load(scope, listing?.path ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rename failed");
      setRenaming(false);
    } finally {
      setRenameBusy(false);
    }
  };

  const askAI = (entry: FileEntry, action: "summarize" | "analyze") => {
    const message = action === "summarize" ? `Summarize the file: ${entry.path}` : `Analyze the file: ${entry.path}`;
    router.push(`/chat?q=${encodeURIComponent(message)}`);
  };

  const copyPath = async (entry: FileEntry) => {
    try {
      await navigator.clipboard.writeText(entry.path);
    } catch {
      // clipboard unavailable
    }
  };

  const goToChatFromSearch = (hit: SearchHit, action: "summarize" | "analyze") => {
    router.push(`/chat?q=${encodeURIComponent(`${action === "summarize" ? "Summarize" : "Analyze"} the file: ${hit.path}`)}`);
  };

  const selectedImageUrl = selected ? `/api/files/media?path=${encodeURIComponent(selected.path)}&scope=${scope}` : "";

  const skeleton = Array.from({ length: 10 }, (_, i) => i);

  return (
    <GlassPanel className="flex h-full min-h-0 overflow-hidden">
      {/* Left rail */}
      <div className="hidden md:flex w-56 flex-col border-r border-slate-800/50 shrink-0 min-h-0">
        <div className="p-2 space-y-1 border-b border-slate-800/50 shrink-0">
          <button
            onClick={() => switchScope("system")}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors border",
              scope === "system" ? "bg-cyan-950/40 text-cyan-400 border-cyan-400/20" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border-transparent"
            )}
          >
            <Cpu size={14} /> System
          </button>
          <button
            onClick={() => switchScope("device")}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors border",
              scope === "device" ? "bg-cyan-950/40 text-cyan-400 border-cyan-400/20" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border-transparent"
            )}
          >
            <HardDrive size={14} /> Device
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {favorites.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1.5 flex items-center gap-1.5 text-hud">
                <Star size={11} className="text-amber-400" /> Favorites
              </div>
              <div className="px-2 pb-2 space-y-0.5">
                {favorites.slice(0, 12).map((favorite) => (
                  <button
                    key={favorite.path}
                    onClick={() => {
                      const entry: FileEntry = { name: favorite.name, path: favorite.path, type: favorite.kind, size: undefined };
                      if (favorite.kind === "directory") navigateTo(favorite.path);
                      else void selectEntry(entry);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-left text-xs text-slate-400 hover:text-cyan-300 hover:bg-slate-800/30 transition-colors"
                  >
                    <Star size={10} className="text-amber-400/80 shrink-0" />
                    <span className="truncate">{favorite.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {recents.length > 0 && (
            <>
              <div className="px-4 pt-2 pb-1.5 flex items-center gap-1.5 text-hud">
                <Clock size={11} className="text-cyan-400" /> Recent
              </div>
              <div className="px-2 pb-2 space-y-0.5">
                {recents.slice(0, 10).map((recent) => (
                  <button
                    key={recent.path}
                    onClick={() => {
                      const entry: FileEntry = { name: recent.name, path: recent.path, type: recent.kind, size: recent.size };
                      if (recent.kind === "directory") navigateTo(recent.path);
                      else void selectEntry(entry);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-left text-xs text-slate-400 hover:text-cyan-300 hover:bg-slate-800/30 transition-colors"
                  >
                    <Clock size={10} className="text-cyan-400/70 shrink-0" />
                    <span className="truncate">{recent.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="px-4 pt-2 pb-1.5 text-hud">{scope === "system" ? "Index" : "Volumes"}</div>
          <div className="px-2 pb-3 space-y-0.5">
            <button
              onClick={() => load(scope, "")}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors border",
                atAnchor ? "bg-cyan-950/40 text-cyan-400 border-cyan-400/20" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border-transparent"
              )}
            >
              <HardDrive size={14} />
              {scope === "system" ? "Workspace" : "This PC"}
            </button>
            {(scope === "system" ? roots : roots).map((rootPath, index) => {
              const label = scope === "system" ? rootPath : rootPath.replace(/[\\/]+$/, "");
              const isActive = scope === "system" ? listing?.name === label : listing?.path === rootPath;
              return (
                <button
                  key={`${rootPath}-${index}`}
                  onClick={() => loading || load(scope, rootPath)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors border",
                    isActive ? "bg-cyan-950/40 text-cyan-400 border-cyan-400/20" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border-transparent"
                  )}
                >
                  <FolderIcon size={14} className="text-amber-400/70" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
            {roots.length === 0 && scope === "system" && <p className="px-2 py-1 text-xs text-slate-600">Loading index…</p>}
          </div>
        </div>
      </div>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Toolbar */}
        <div className="flex flex-col gap-2 px-4 py-3 border-b border-slate-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500" />
              <input
                type="text"
                value={globalQuery}
                onChange={(event) => {
                  setGlobalQuery(event.target.value);
                  if (event.target.value.trim() === "") setGlobalHits(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void runGlobalSearch();
                  if (event.key === "Escape") {
                    setGlobalQuery("");
                    setGlobalHits(null);
                  }
                }}
                placeholder={`Search ${scope === "system" ? "workspace" : "device"} by name or content (Enter)…`}
                className="w-full pl-9 pr-3 py-1.5 bg-navy-950/60 border border-slate-700/50 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <button
              onClick={() => void runGlobalSearch()}
              className="px-3 py-1.5 rounded-lg text-xs font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-400/25 hover:bg-cyan-500/20 transition-colors"
            >
              {globalBusy ? <Loader2 size={12} className="animate-spin" /> : "Search"}
            </button>
            <button
              onClick={goHome}
              disabled={atAnchor}
              title={scope === "system" ? "Workspace root" : "This PC"}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <Home size={16} />
            </button>
            <button
              onClick={goUp}
              disabled={listing?.parent == null}
              title="Parent directory"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ArrowUp size={16} />
            </button>
            <button
              onClick={() => load(scope, listing?.path ?? "")}
              title="Refresh"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              {TYPE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setTypeFilter(option.key)}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[11px] font-mono transition-colors border",
                    typeFilter === option.key
                      ? "bg-cyan-950/40 text-cyan-400 border-cyan-400/30"
                      : "text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-600"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-1 text-[11px] font-mono">
              {(["name", "size", "date"] as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => permuteSort(key)}
                  className={cn(
                    "px-2 py-1 rounded-md capitalize transition-colors flex items-center gap-1",
                    sortKey === key ? "text-cyan-400 bg-cyan-950/30" : "text-slate-500 hover:text-slate-300"
                  )}
                  title={`Sort by ${key}`}
                >
                  {key}
                  {sortKey === key && <ChevronDown size={10} className={cn(sortDir === "desc" && "rotate-180 transition-transform")} />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Breadcrumb */}
        {!globalHits && (
          <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-800/50 text-sm shrink-0 overflow-x-auto">
            {crumbs.map((crumb, index) => (
              <span key={`${crumb.path}-${index}`} className="flex items-center gap-1 whitespace-nowrap">
                {index > 0 && <ChevronRight size={12} className="text-slate-600" />}
                <button
                  onClick={() => load(scope, crumb.path)}
                  className={cn(
                    "px-1.5 py-0.5 rounded hover:bg-slate-800/40 transition-colors",
                    index === crumbs.length - 1 ? "text-cyan-400 font-mono" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  {crumb.label}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {globalHits !== null ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 pb-2 text-hud">
                <Search size={12} className="text-cyan-400" />
                {globalHits.length} {globalHits.length === 1 ? "result" : "results"} for “{globalQuery}”
                <button onClick={() => setGlobalHits(null)} className="ml-auto text-slate-500 hover:text-cyan-300 text-xs" title="Back to folder">
                  <X size={13} />
                </button>
              </div>
              {globalHits.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-2 text-slate-500">
                  <SearchX size={28} className="text-slate-600" />
                  <p className="text-sm">No matches. Try a different name, or enable content search with 3+ characters.</p>
                </div>
              )}
              {globalHits.map((hit) => (
                <div
                  key={hit.path}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-800/60 bg-navy-950/40 hover:bg-slate-800/30 transition-colors"
                >
                  <span className="shrink-0">
                    {hit.type === "directory" ? <FolderOpen size={16} className="text-amber-400" /> : <FileText size={16} className="text-blue-400" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-200 truncate">{hit.name}</p>
                    <p className="text-[10px] font-mono text-slate-500 truncate">{hit.path}</p>
                  </div>
                  <span className={cn("shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded", hit.matched === "content" ? "text-fuchsia-400 bg-fuchsia-500/10" : "text-emerald-400 bg-emerald-500/10")}>
                    {hit.matched === "content" ? "content" : "name"}
                  </span>
                  {hit.size != null && hit.type === "file" && <span className="shrink-0 text-[10px] text-slate-500 font-mono">{formatBytes(hit.size)}</span>}
                  <div className="flex items-center gap-1 shrink-0">
                    {hit.type === "directory" ? (
                      <button onClick={() => navigateTo(hit.path)} className="px-2 py-1 text-[11px] font-mono text-cyan-400 border border-cyan-400/25 rounded-md hover:bg-cyan-500/10">
                        Open
                      </button>
                    ) : (
                      <>
                        <button onClick={() => void selectEntry({ name: hit.name, path: hit.path, type: "file", size: hit.size })} className="px-2 py-1 text-[11px] font-mono text-cyan-400 border border-cyan-400/25 rounded-md hover:bg-cyan-500/10">
                          Preview
                        </button>
                        <button onClick={() => goToChatFromSearch(hit, "summarize")} className="px-2 py-1 text-[11px] font-mono text-violet-400 border border-violet-400/25 rounded-md hover:bg-violet-500/10">
                          Summarize
                        </button>
                        <button onClick={() => goToChatFromSearch(hit, "analyze")} className="px-2 py-1 text-[11px] font-mono text-amber-400 border border-amber-400/25 rounded-md hover:bg-amber-500/10">
                          Analyze
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <p className="text-sm text-rose-400">{error}</p>
              <button onClick={() => load(scope, listing?.path ?? "")} className="btn-hud">
                Retry
              </button>
            </div>
          ) : !error && listing && listing.entries.length === 0 && !loading ? (
            <div className="flex items-center justify-center h-full text-sm text-slate-500">This folder is empty.</div>
          ) : loading || !listing ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {skeleton.map((i) => (
                <div key={i} className="h-28 rounded-lg border border-slate-800/40 bg-navy-900/40 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {listing.truncated && <p className="mb-3 text-xs text-amber-400/80">Directory is large — showing the first {listing.entries.length} entries.</p>}
              {sorted.length === 0 && listing.entries.length > 0 && (
                <div className="flex items-center justify-center h-40 text-sm text-slate-500">
                  No files match the current filter.
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {sorted.map((entry) => {
                  const notes: string[] = [];
                  const dup = entry.type === "file" && duplicateKeys.has(`${entry.name.toLowerCase()}|${entry.size ?? ""}`);
                  if (entry.size != null) {
                    if (entry.type === "directory" && scope === "device") notes.push(`capacity ${formatBytes(entry.size)}`);
                    else if (entry.type === "file") notes.push(formatBytes(entry.size));
                  }
                  const date = formatDate(entry.modifiedAt);
                  if (date) notes.push(date);
                  const meta = notes.join(" · ");
                  const fav = isFavorite(entry.path);
                  return (
                    <button
                      key={entry.path}
                      onClick={() => void selectEntry(entry)}
                      className="group flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-800/40 hover:bg-slate-800/40 hover:border-cyan-400/30 cursor-pointer text-center"
                    >
                      <span className="relative transition-transform group-hover:scale-105">
                        <FileGlyph entry={entry} />
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            void toggleFavorite(entry);
                          }}
                          className={cn(
                            "absolute -top-1.5 -right-1.5 p-0.5 rounded-full transition-colors",
                            fav ? "text-amber-400" : "text-slate-600 opacity-0 group-hover:opacity-100 hover:text-amber-300"
                          )}
                          title={fav ? "Remove favorite" : "Add favorite"}
                        >
                          <Star size={12} className={fav ? "fill-current" : ""} />
                        </button>
                        {dup && (
                          <span className="absolute -bottom-1.5 -left-1.5 px-1 py-0.5 rounded bg-amber-500/90 text-[9px] font-mono font-bold text-navy-950" title="Possible duplicate (same name and size)">
                            ⧉
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-slate-300 text-center break-all leading-snug line-clamp-2">{entry.name}</span>
                      {meta && <span className="text-[10px] text-slate-600 font-mono whitespace-nowrap">{meta}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800/50 text-[11px] text-slate-600 font-mono shrink-0">
          <span>
            {scope === "system" ? "SYSTEM" : "DEVICE"} · {globalHits !== null ? globalHits.length : listing ? listing.entries.length : 0} · {sorted.length} shown
          </span>
          <span className="truncate max-w-[60%]">{listing?.path || listing?.name || ""}</span>
          {loading && (
            <span className="flex items-center gap-1 text-cyan-500">
              <Loader2 size={11} className="animate-spin" /> syncing
            </span>
          )}
        </div>
      </div>

      {/* Preview pane */}
      {selected && (
        <aside className="hidden lg:flex w-80 shrink-0 flex-col border-l border-slate-800/50 min-h-0">
          <div className="px-4 py-3 border-b border-slate-800/50 flex items-start justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-200 truncate">{selected.name}</p>
                {preview !== "loading" && preview && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-slate-800 text-[9px] font-mono uppercase tracking-wider text-slate-400">
                    {preview.kind}
                  </span>
                )}
              </div>
              <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5">{selected.path}</p>
            </div>
            <button onClick={() => { setSelected(null); setPreview(null); }} className="text-slate-500 hover:text-slate-200 shrink-0" title="Close preview">
              <X size={15} />
            </button>
          </div>

          <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-800/50 shrink-0 flex-wrap">
            <button onClick={() => void openEntry(selected)} className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono text-cyan-400 border border-cyan-400/25 hover:bg-cyan-500/10">
              <ExternalLink size={11} /> Open
            </button>
            <button onClick={() => copyPath(selected)} className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono text-slate-400 border border-slate-700 hover:text-slate-200 hover:bg-slate-800/40">
              <Copy size={11} /> Path
            </button>
            <button onClick={() => void toggleFavorite(selected)} className={cn("flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono border", isFavorite(selected.path) ? "text-amber-400 border-amber-400/30 bg-amber-500/10" : "text-slate-400 border-slate-700 hover:text-amber-300 hover:bg-slate-800/40")}>
              <Star size={11} className={isFavorite(selected.path) ? "fill-current" : ""} />
              {isFavorite(selected.path) ? "Saved" : "Star"}
            </button>
            <button onClick={startRename} className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono text-slate-400 border border-slate-700 hover:text-slate-200 hover:bg-slate-800/40">
              <Pencil size={11} /> Rename
            </button>
            <button onClick={() => askAI(selected, "summarize")} className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono text-violet-400 border border-violet-400/25 hover:bg-violet-500/10">
              <Sparkles size={11} /> Summarize
            </button>
            <button onClick={() => askAI(selected, "analyze")} className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono text-amber-400 border border-amber-400/25 hover:bg-amber-500/10">
              <Wand2 size={11} /> Analyze
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {renaming && (
              <div className="mb-3 flex items-center gap-2">
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submitRename();
                    if (event.key === "Escape") setRenaming(false);
                  }}
                  className="flex-1 min-w-0 bg-navy-950/70 border border-cyan-400/40 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                />
                <button onClick={() => void submitRename()} disabled={renameBusy} className="px-2 py-1 text-[11px] font-mono text-cyan-400 border border-cyan-400/30 rounded-md hover:bg-cyan-500/10 disabled:opacity-50">
                  {renameBusy ? <Loader2 size={11} className="animate-spin" /> : "Save"}
                </button>
                <button onClick={() => setRenaming(false)} className="px-2 py-1 text-[11px] font-mono text-slate-400 border border-slate-700 rounded-md hover:text-slate-200">
                  Cancel
                </button>
              </div>
            )}

            {preview === "loading" ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 size={16} className="animate-spin text-cyan-400" />
              </div>
            ) : preview === null ? null : preview.kind === "image" ? (
              <div className="flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedImageUrl} alt={preview.name} className="max-w-full rounded-lg border border-slate-800 bg-black/30" />
                {preview.note && <p className="text-[11px] text-slate-500 text-center">{preview.note}</p>}
              </div>
            ) : preview.kind === "csv" && preview.text ? (
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="text-[11px] font-mono">
                  <tbody>
                    {csvRows(preview.text).map((row, rowIndex) => (
                      <tr key={rowIndex} className={rowIndex === 0 ? "bg-slate-800/50 text-cyan-300" : "odd:bg-navy-950/40"}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-2 py-1 border border-slate-800 whitespace-nowrap text-slate-300">
                            {cell.length > 60 ? `${cell.slice(0, 60)}…` : cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.truncated && <p className="p-2 text-[10px] text-slate-500">Preview truncated.</p>}
              </div>
            ) : preview.kind === "json" && preview.text ? (
              <pre className="text-[11px] font-mono leading-snug text-emerald-300/90 whitespace-pre-wrap bg-navy-950/40 rounded-lg p-3 border border-slate-800">
                {preview.text}
              </pre>
            ) : preview.text ? (
              <pre className="text-[11px] font-mono leading-relaxed text-slate-300 whitespace-pre-wrap bg-navy-950/40 rounded-lg p-3 border border-slate-800 max-h-[50vh] overflow-y-auto">
                {preview.text}
              </pre>
            ) : preview.note ? (
              <p className="text-xs text-slate-500 text-center py-10">{preview.note}</p>
            ) : (
              <p className="text-xs text-slate-500 text-center py-10">No preview available.</p>
            )}
          </div>

          {preview !== "loading" && preview && (
            <div className="px-4 py-3 border-t border-slate-800/50 text-[10px] font-mono text-slate-500 space-y-1 shrink-0">
              {preview.size != null && <p>Size · {formatBytes(preview.size)}</p>}
              {preview.extension && <p>Type · {preview.extension.toUpperCase()}</p>}
              {preview.modifiedAt && <p>Modified · {formatDate(preview.modifiedAt)}</p>}
              {preview.truncated && <p className="text-amber-400/70">Content truncated.</p>}
            </div>
          )}
        </aside>
      )}
    </GlassPanel>
  );
}