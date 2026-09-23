"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBrand } from "@/context/BrandContext";
import { cn } from "@/lib/utils";
import {
  Home,
  MessageSquare,
  Mic,
  CheckSquare,
  FolderOpen,
  LayoutGrid,
  CalendarDays,
  Workflow,
  Bot,
  FolderKanban,
  Code2,
  Palette,
  Puzzle,
  ShieldCheck,
  Radar,
  Activity,
  Settings,
  History,
  Search,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Zap,
  Command,
} from "lucide-react";

type Category = "all" | "files" | "apps" | "system" | "web" | "ai";

interface CommandEntry {
  label: string;
  href: string;
  description: string;
  category: Exclude<Category, "all">;
  icon: React.ReactNode;
}

const NAV_ENTRIES: CommandEntry[] = [
  { label: "Home", href: "/", description: "Return to the dashboard", category: "system", icon: <Home size={15} /> },
  { label: "Chat", href: "/chat", description: "Talk to TECHY directly", category: "ai", icon: <MessageSquare size={15} /> },
  { label: "Voice", href: "/voice", description: "Voice-mode conversation", category: "ai", icon: <Mic size={15} /> },
  { label: "Calendar", href: "/calendar", description: "Events, meetings and agenda", category: "files", icon: <CalendarDays size={15} /> },
  { label: "Automations", href: "/automations", description: "Run and manage workflows", category: "files", icon: <Workflow size={15} /> },
  { label: "Tasks", href: "/tasks", description: "To-dos and reminders", category: "files", icon: <CheckSquare size={15} /> },
  { label: "Files", href: "/files", description: "Browse and search your files", category: "files", icon: <FolderOpen size={15} /> },
  { label: "Apps", href: "/apps", description: "Discover and launch applications", category: "apps", icon: <LayoutGrid size={15} /> },
  { label: "Agents", href: "/agents", description: "Specialist agents and routing", category: "ai", icon: <Bot size={15} /> },
  { label: "Projects", href: "/projects", description: "Project workspaces", category: "files", icon: <FolderKanban size={15} /> },
  { label: "Developer", href: "/developer", description: "Git, logs, ports and scripts", category: "system", icon: <Code2 size={15} /> },
  { label: "Creative", href: "/designer", description: "Artwork inspection and print checks", category: "system", icon: <Palette size={15} /> },
  { label: "Plugins", href: "/plugins", description: "Plugin and tool catalog", category: "system", icon: <Puzzle size={15} /> },
  { label: "Activity", href: "/activity", description: "Everything TECHY has done", category: "system", icon: <History size={15} /> },
  { label: "Security", href: "/security", description: "Permissions and local-only mode", category: "system", icon: <ShieldCheck size={15} /> },
  { label: "Offline", href: "/offline", description: "Offline-first status and services", category: "system", icon: <Radar size={15} /> },
  { label: "System", href: "/system", description: "Hardware metrics and processes", category: "system", icon: <Activity size={15} /> },
  { label: "Settings", href: "/settings", description: "Provider, memory and personalization", category: "system", icon: <Settings size={15} /> },
];

const QUICK_ACTIONS: CommandEntry[] = [
  { label: "Open the morning briefing", href: "/", description: "Calendar, tasks and system in one report", category: "ai", icon: <Zap size={15} /> },
  { label: "Find a file in my workspace", href: "/files", description: "Search by name or content", category: "files", icon: <Search size={15} /> },
  { label: "Check system resources", href: "/system", description: "CPU, RAM and processes", category: "system", icon: <Activity size={15} /> },
  { label: "Launch an app", href: "/apps", description: "Browse installed applications", category: "apps", icon: <LayoutGrid size={15} /> },
];

const CATEGORIES: Array<{ key: Category; label: string }> = [
  { key: "all", label: "All" },
  { key: "files", label: "Files" },
  { key: "apps", label: "Apps" },
  { key: "system", label: "System" },
  { key: "web", label: "Web" },
  { key: "ai", label: "AI" },
];

export function CommandMode() {
  const { brand, accent } = useBrand();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Global shortcut: Ctrl+Space (and Ctrl+K fallback on non-WebKit)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.code === "Space") {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }
      if (event.key === "Escape" && open) close();
    };
    const onEvent = () => setOpen((current) => !current);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("techy:command", onEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("techy:command", onEvent);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      setQuery("");
      setCategory("all");
      setSelected(0);
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const entries = useMemo(() => {
    const source = query.trim().length === 0 ? QUICK_ACTIONS.concat(NAV_ENTRIES) : NAV_ENTRIES;
    const q = query.trim().toLowerCase();
    const filtered = source.filter((entry) => entry.label.toLowerCase().includes(q) || entry.description.toLowerCase().includes(q));
    return category === "all" ? filtered : filtered.filter((entry) => entry.category === category);
  }, [query, category]);

  const run = useCallback(
    (entry: CommandEntry) => {
      close();
      setQuery("");
      router.push(entry.href);
    },
    [router, close]
  );

  const submit = useCallback(() => {
    const q = query.trim();
    if (!q) return;
    if (entries[selected]) {
      run(entries[selected]);
      return;
    }
    close();
    setQuery("");
    router.push(`/chat?q=${encodeURIComponent(q)}`);
  }, [query, entries, selected, run, router, close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-navy-950/70 backdrop-blur-md" onClick={close} />

      {/* Ambience */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full opacity-25 blur-3xl" style={{ background: `radial-gradient(circle at center, ${accent.hex}33, transparent 60%)` }} />
        <div className="absolute inset-0 cm-grid opacity-40" />
        <div className="absolute inset-x-0 top-0 h-px cm-beam" style={{ background: `linear-gradient(90deg, transparent, ${accent.hex}, transparent)` }} />
      </div>

      {/* Floating Panel */}
      <div className="absolute inset-0 flex items-start justify-center pt-[14vh] px-4">
        <div className="animate-fade-in w-full max-w-xl">
          <div className="relative rounded-2xl border bg-navy-950/90 backdrop-blur-2xl shadow-2xl overflow-hidden" style={{ borderColor: `${accent.hex}40`, boxShadow: `0 0 0 1px ${accent.hex}22, 0 24px 80px rgba(2,8,23,0.9), 0 0 60px ${accent.hex}22` }}>
            {/* HUD corners */}
            <div className="pointer-events-none absolute -left-px -top-px w-8 h-8 border-l-2 border-t-2 rounded-tl-2xl" style={{ borderColor: accent.hex }} />
            <div className="pointer-events-none absolute -right-px -top-px w-8 h-8 border-r-2 border-t-2 rounded-tr-2xl" style={{ borderColor: accent.hex }} />
            <div className="pointer-events-none absolute -left-px -bottom-px w-8 h-8 border-l-2 border-b-2 rounded-bl-2xl" style={{ borderColor: accent.hex }} />
            <div className="pointer-events-none absolute -right-px -bottom-px w-8 h-8 border-r-2 border-b-2 rounded-br-2xl" style={{ borderColor: accent.hex }} />

            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-5">
              <div className="relative flex items-center justify-center">
                <span className="absolute w-10 h-10 rounded-full animate-ping opacity-40" style={{ backgroundColor: accent.hex, filter: "blur(6px)" }} />
                <span className="relative w-10 h-10 rounded-full border flex items-center justify-center" style={{ borderColor: `${accent.hex}66`, color: accent.hex, boxShadow: `0 0 20px ${accent.hex}44, inset 0 0 20px ${accent.hex}22` }}>
                  <Command size={17} />
                </span>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: accent.hex }}>Command Mode</div>
                <h2 className="font-display text-lg font-medium text-slate-100 tracking-wide">
                  What would you like {brand.aiName} to do?
                </h2>
              </div>
            </div>

            {/* Input */}
            <div className="px-5 pt-4">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setSelected(0); }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") { event.preventDefault(); submit(); }
                    if (event.key === "ArrowDown") { event.preventDefault(); setSelected((s) => Math.min(s + 1, entries.length - 1)); }
                    if (event.key === "ArrowUp") { event.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
                    if (event.key === "Escape") close();
                  }}
                  placeholder="Find the latest proposal and summarize it"
                  className="w-full rounded-xl border bg-navy-900/80 text-base text-slate-100 placeholder-slate-500 py-3.5 pl-4 pr-24 focus:outline-none focus:ring-0"
                  style={{ borderColor: `${accent.hex}55`, boxShadow: `0 0 0 1px ${accent.hex}22 inset` }}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] font-mono text-slate-500">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-400 flex items-center gap-1"><CornerDownLeft size={9} /> Run</kbd>
                </div>
              </div>
            </div>

            {/* Category chips */}
            <div className="px-5 pt-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {CATEGORIES.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => { setCategory(item.key); setQuery(""); setSelected(0); }}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider border transition-colors",
                      category === item.key ? "text-slate-900" : "border-slate-800/70 text-slate-500 hover:text-slate-200"
                    )}
                    style={category === item.key ? { backgroundColor: accent.hex, borderColor: accent.hex, boxShadow: `0 0 16px ${accent.hex}44` } : undefined}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="px-5 pt-3" style={{ borderTop: undefined }}>
              <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${accent.hex}44, transparent)` }} />
            </div>

            {/* Suggestions */}
            <div className="px-3 py-3 max-h-[300px] overflow-y-auto cm-scroll">
              {entries.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-slate-600">
                  <p className="text-xs font-mono">No matching surface for “{query}”</p>
                  <p className="text-[11px]">Press Enter to ask {brand.aiName} via chat instead.</p>
                </div>
              ) : (
                entries.map((entry, index) => (
                  <button
                    key={`${entry.href}-${entry.label}`}
                    type="button"
                    onMouseEnter={() => setSelected(index)}
                    onClick={() => run(entry)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                      index === selected ? "border text-slate-100" : "border border-transparent text-slate-300 hover:bg-slate-800/40"
                    )}
                    style={index === selected ? { backgroundColor: `${accent.hex}1a`, borderColor: `${accent.hex}44` } : undefined}
                  >
                    <span className="w-7 h-7 rounded-md border border-slate-700/60 bg-navy-950/60 flex items-center justify-center shrink-0" style={{ color: index === selected ? accent.hex : undefined }}>
                      {entry.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">{entry.label}</span>
                      <span className="block text-[10px] text-slate-500 truncate">{entry.description}</span>
                    </span>
                    <span className="text-[9px] font-mono uppercase tracking-wider text-slate-600 shrink-0">
                      {entry.category}
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800/50 bg-navy-950/80">
              <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
                <span className="flex items-center gap-1"><ArrowUp size={9} /><ArrowDown size={9} /> navigate</span>
                <span className="flex items-center gap-1"><CornerDownLeft size={9} /> run / ask</span>
                <span className="flex items-center gap-1">ESC close</span>
              </div>
              <div className="text-[10px] font-mono" style={{ color: `${accent.hex}cc` }}>
                {brand.aiName} · runs locally
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}