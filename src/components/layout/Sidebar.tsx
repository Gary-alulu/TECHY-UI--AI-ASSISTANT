"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { useBrand } from "@/context/BrandContext";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";
import { cn } from "@/lib/utils";
import { AVATARS, type AvatarKey } from "@/lib/accents";
import {
  Home,
  MessageSquare,
  Mic,
  CheckSquare,
  FolderOpen,
  LayoutGrid,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Database,
  Monitor,
  CalendarDays,
  Workflow,
  Bot,
  Code2,
  Palette,
  FolderKanban,
  Puzzle,
  ShieldCheck,
  History,
  Radar,
  Cpu as CpuIcon,
  Network,
  Orbit,
  Hexagon,
  ClipboardList,
  FileSearch,
  Target,
  NotebookPen,
  AudioLines,
  Music,
  LayoutPanelLeft,
  Network as NetworkIcon,
  Boxes,
  Usb,
  Stethoscope,
  HeartPulse,
  BrainCircuit,
  Brain,
  ShieldAlert,
  Sparkles,
  Terminal,
} from "lucide-react";
import { StatusIndicator } from "../ui/StatusIndicator";

const AVATAR_ICONS = { Cpu: CpuIcon, Network: Network, Orbit: Orbit, Hexagon: Hexagon } as const;

const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Chat", href: "/chat", icon: MessageSquare },
  { label: "Voice", href: "/voice", icon: Mic },
  { label: "Clipboard", href: "/clipboard", icon: ClipboardList },
  { label: "Screen", href: "/screen", icon: Monitor },
  { label: "Research", href: "/research", icon: FileSearch },
  { label: "Planner", href: "/planner", icon: Target },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Automations", href: "/automations", icon: Workflow },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Meetings", href: "/meetings", icon: NotebookPen },
  { label: "Commands", href: "/commands", icon: Terminal },
  { label: "Files", href: "/files", icon: FolderOpen },
  { label: "Apps", href: "/apps", icon: LayoutGrid },
  { label: "Audio", href: "/audio", icon: AudioLines },
  { label: "Media", href: "/media", icon: Music },
  { label: "Workspaces", href: "/workspaces", icon: LayoutPanelLeft },
  { label: "Agents", href: "/agents", icon: Bot },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Developer", href: "/developer", icon: Code2 },
  { label: "Creative", href: "/designer", icon: Palette },
  { label: "Plugins", href: "/plugins", icon: Puzzle },
  { label: "Activity", href: "/activity", icon: History },
  { label: "Capabilities", href: "/capabilities", icon: Sparkles },
  { label: "Memory", href: "/memory", icon: Brain },
  { label: "Models", href: "/models", icon: BrainCircuit },
  { label: "Network", href: "/network", icon: NetworkIcon },
  { label: "Hardware", href: "/hardware", icon: Boxes },
  { label: "Devices", href: "/devices", icon: Usb },
  { label: "Diagnose", href: "/diagnose", icon: Stethoscope },
  { label: "Health", href: "/health", icon: HeartPulse },
  { label: "Security", href: "/security", icon: ShieldCheck },
  { label: "Safe Mode", href: "/safemode", icon: ShieldAlert },
  { label: "Offline", href: "/offline", icon: Radar },
  { label: "System", href: "/system", icon: Activity },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, aiState, isLocalAIConnected } = useApp();
  const { brand, accent } = useBrand();
  const pathname = usePathname();
  const { metrics } = useSystemMetrics(5000); // Slow update for mini bars
  const AvatarIcon = AVATAR_ICONS[AVATARS[brand.avatar as AvatarKey]?.icon ?? "Cpu"];

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out bg-navy-950/80 backdrop-blur-xl border-r flex flex-col",
        sidebarCollapsed ? "w-[60px]" : "w-64"
      )}
      style={{ borderColor: `${accent.hex}26` }}
    >
      {/* Header / Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b" style={{ borderColor: `${accent.hex}1a` }}>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded bg-navy-950 border flex items-center justify-center" style={{ borderColor: `${accent.hex}4d`, color: accent.hex, boxShadow: `0 0 14px ${accent.hex}44` }}>
              <AvatarIcon size={16} />
            </div>
            <span className="font-display font-bold tracking-widest text-slate-100 text-lg">{brand.aiName}</span>
          </div>
        )}

        {sidebarCollapsed && (
          <div className="w-8 h-8 mx-auto rounded bg-navy-950 border flex items-center justify-center mb-0" style={{ borderColor: `${accent.hex}4d`, color: accent.hex, boxShadow: `0 0 14px ${accent.hex}44` }}>
            <AvatarIcon size={16} />
          </div>
        )}

        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={cn(
            "p-1.5 rounded-md text-slate-400 hover:text-cyan-400 hover:bg-cyan-950/30 transition-colors",
            sidebarCollapsed && "hidden sm:flex mx-auto mt-4 absolute top-16 left-0 right-0 justify-center"
          )}
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-2 overflow-y-auto overflow-x-hidden flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                isActive 
                  ? "bg-cyan-950/40 text-cyan-400 border border-cyan-400/20" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent",
                sidebarCollapsed && "justify-center px-0"
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-cyan-400 rounded-r-full glow-cyan" />
              )}
              <item.icon size={20} className={cn("shrink-0", isActive && "drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]")} />
              
              {!sidebarCollapsed && (
                <span className="font-medium text-sm tracking-wide">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Status Area */}
      <div className="p-4 border-t border-cyan-400/10 bg-navy-950/50">
        {!sidebarCollapsed ? (
          <div className="space-y-4 animate-fade-in">
            {/* AI Status */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">Local Core</span>
                <StatusIndicator 
                  status={isLocalAIConnected ? (aiState.state === 'idle' ? 'online' : 'processing') : 'offline'} 
                />
              </div>
              <div className="text-xs font-medium text-slate-300 truncate">{aiState.label}</div>
            </div>

            {/* Mini Metrics */}
            <div className="space-y-2">
              <MiniMetricBar label="CPU" icon={<Cpu size={10} />} value={metrics.cpu.percentage} />
              <MiniMetricBar label="RAM" icon={<Database size={10} />} value={metrics.ram.percentage} />
              <MiniMetricBar label="GPU" icon={<Monitor size={10} />} value={metrics.gpu.percentage} />
            </div>

            {/* Badge */}
            <div className="mt-4 py-1.5 px-2 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-medium tracking-wide text-emerald-400 uppercase">Running Locally</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <StatusIndicator status={isLocalAIConnected ? (aiState.state === 'idle' ? 'online' : 'processing') : 'offline'} />
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Running Locally" />
          </div>
        )}
      </div>
    </aside>
  );
}

function MiniMetricBar({ label, icon, value }: { label: string; icon: React.ReactNode; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-10 flex items-center gap-1 text-[10px] text-slate-400 font-mono">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full rounded-full transition-all duration-1000",
            value > 85 ? "bg-red-500" : value > 70 ? "bg-amber-500" : "bg-cyan-500"
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
