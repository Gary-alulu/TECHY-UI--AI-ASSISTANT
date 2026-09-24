"use client";

import React from "react";
import Link from "next/link";
import { useBrand } from "@/context/BrandContext";
import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  Activity,
  AudioLines,
  Bot,
  BrainCircuit,
  CheckSquare,
  ClipboardList,
  Code2,
  FolderOpen,
  HeartPulse,
  LayoutPanelLeft,
  Lock,
  MessageSquare,
  Mic,
  Monitor,
  Music,
  Network,
  NotebookPen,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Terminal,
  Usb,
  Workflow,
  Wrench,
} from "lucide-react";

interface Capability {
  label: string;
  description: string;
  href?: string;
  chat?: string;
  icon: React.ReactNode;
  accent: string;
}

function group(label: string, items: Capability[]) {
  return { label, items };
}

export function CapabilitiesPanel() {
  const { brand, accent } = useBrand();

  const groups = [
    group("Conversation", [
      { label: "Chat", description: "Natural conversation with a local model — no cloud required.", href: "/chat", chat: "Open a conversation", icon: <MessageSquare size={14} />, accent: "text-cyan-400" },
      { label: "Voice", description: "Talk out loud and hear replies spoken back.", href: "/voice", chat: "Talk to me", icon: <Mic size={14} />, accent: "text-cyan-400" },
      { label: "Command palette", description: "Jump to any action with Ctrl + Space.", chat: "Open the palette", icon: <Search size={14} />, accent: "text-cyan-400" },
      { label: "Agents", description: "Specialist roles for research, files, coding, design and more.", href: "/agents", chat: "Introduce your agents", icon: <Bot size={14} />, accent: "text-violet-400" },
    ]),
    group("Know your machine", [
      { label: "System monitor", description: "CPU, RAM, GPU, disks and processes in real time.", href: "/system", chat: "What is using the most RAM?", icon: <Activity size={14} />, accent: "text-cyan-400" },
      { label: "Hardware dashboard", description: "Motherboard, BIOS, fans, displays and thermals.", href: "/hardware", chat: "What motherboard do I have?", icon: <Monitor size={14} />, accent: "text-violet-400" },
      { label: "Smart troubleshooting", description: "Find out why things feel slow.", href: "/diagnose", chat: "Why is my computer slow?", icon: <Stethoscope size={14} />, accent: "text-emerald-400" },
      { label: "Self-diagnostics", description: "A transparent, measurable health score.", href: "/health", chat: "How healthy is my system?", icon: <HeartPulse size={14} />, accent: "text-emerald-400" },
      { label: "Network intelligence", description: "Throughput, latency, adapters and LAN neighbors.", href: "/network", chat: "Who is on my network?", icon: <Network size={14} />, accent: "text-amber-400" },
      { label: "Device manager", description: "Keyboard, mouse, headset, webcam — at a glance.", href: "/devices", chat: "Is my headset connected?", icon: <Usb size={14} />, accent: "text-amber-400" },
    ]),
    group("Be productive", [
      { label: "Meeting assistant", description: "Plan meetings, take notes, summarize and extract action items.", href: "/meetings", chat: "Summarize my meeting notes", icon: <NotebookPen size={14} />, accent: "text-cyan-400" },
      { label: "Audio intelligence", description: "Speaker separation, summaries and action items from transcripts.", href: "/audio", chat: "What were the decisions in my call?", icon: <AudioLines size={14} />, accent: "text-violet-400" },
      { label: "Tasks & reminders", description: "Track what needs doing and get reminded.", href: "/tasks", chat: "Remind me to invoice the client", icon: <CheckSquare size={14} />, accent: "text-emerald-400" },
      { label: "Calendar", description: "Events, prep and intelligent briefing.", href: "/calendar", chat: "What is on my calendar?", icon: <Activity size={14} />, accent: "text-cyan-400" },
      { label: "Automations", description: "Rules that watch folders and run workflows.", href: "/automations", chat: "Automate my Downloads folder", icon: <Workflow size={14} />, accent: "text-amber-400" },
      { label: "Clipboard & screen", description: "Describe what is on your clipboard or monitor.", href: "/clipboard", chat: "Summarize my clipboard", icon: <ClipboardList size={14} />, accent: "text-cyan-400" },
      { label: "Smart workspaces", description: "Open the right apps on the right monitor, in one tap.", href: "/workspaces", chat: "Start my design workspace", icon: <LayoutPanelLeft size={14} />, accent: "text-violet-400" },
    ]),
    group("Work with files & media", [
      { label: "Files", description: "Browse, search, rename and open local files safely.", href: "/files", chat: "Find my recent files", icon: <FolderOpen size={14} />, accent: "text-cyan-400" },
      { label: "Media center", description: "Play your music, videos and podcasts.", href: "/media", chat: "Play my design playlist", icon: <Music size={14} />, accent: "text-violet-400" },
      { label: "Research", description: "Deep web and local research with citations.", href: "/research", chat: "Research this topic for me", icon: <Search size={14} />, accent: "text-cyan-400" },
      { label: "Creative mode", description: "Inspect images, palettes and document quality.", href: "/designer", chat: "Analyze this image", icon: <Palette size={14} />, accent: "text-pink-400" },
    ]),
    group("Trust & control", [
      { label: "Command history", description: "Everything TECHY has been asked, with templates.", href: "/commands", chat: "What have I asked you recently?", icon: <Terminal size={14} />, accent: "text-cyan-400" },
      { label: "Capabilities", description: "This page — a live map of what TECHY can do.", chat: "What can you do?", icon: <Sparkles size={14} />, accent: "text-cyan-400" },
      { label: "Memory inspector", description: "See and curate exactly what TECHY remembers.", href: "/memory", chat: "What do you remember about me?", icon: <BrainCircuit size={14} />, accent: "text-violet-400" },
      { label: "Model lab", description: "Manage local model load and route tasks to them.", href: "/models", chat: "Use the coding model for this", icon: <Code2 size={14} />, accent: "text-emerald-400" },
      { label: "Security center", description: "Permissions for file access, launching, terminal.", href: "/security", chat: "Change my security settings", icon: <ShieldCheck size={14} />, accent: "text-amber-400" },
      { label: "Safe mode", description: "Emergency lockdown of computer control.", href: "/safemode", chat: "Enter safe mode", icon: <Lock size={14} />, accent: "text-red-400" },
      { label: "Apps", description: "Launch and manage applications.", href: "/apps", chat: "Open Figma", icon: <Wrench size={14} />, accent: "text-emerald-400" },
      { label: "Developer", description: "Git status, ports, logs and node processes.", href: "/developer", chat: "Show me the local dev servers", icon: <Code2 size={14} />, accent: "text-violet-400" },
    ]),
  ];

  return (
    <div className="flex flex-col gap-6">
      <GlassPanel className="p-5 flex items-center gap-3 border-cyan-400/20" hudCorners>
        <div className="w-11 h-11 rounded-lg bg-navy-950 border flex items-center justify-center" style={{ borderColor: `${accent.hex}4d`, color: accent.hex, boxShadow: `0 0 16px ${accent.hex}33` }}>
          <Sparkles size={18} />
        </div>
        <div>
          <p className="text-sm text-slate-300">{brand.aiName} is a local-first copilot for this machine — every feature here can also be triggered by asking in Chat.</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Try: <span className="font-mono text-cyan-400/80">“What can you do?”</span></p>
        </div>
      </GlassPanel>

      {groups.map((groupData) => (
        <div key={groupData.label}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{groupData.label}</span>
            <div className="h-px flex-1 bg-slate-800/70" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {groupData.items.map((capability) => {
              const inner = (
                <>
                  <div className="w-8 h-8 rounded-md bg-navy-950 border border-slate-800 flex items-center justify-center shrink-0" style={{ color: accent.hex }}>
                    <span className={capability.accent}>{capability.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-slate-200">{capability.label}</div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{capability.description}</p>
                    {capability.chat && (
                      <p className="text-[10px] font-mono text-slate-600 mt-1">
                        <span className="text-cyan-400/70">say:</span> “{capability.chat}”
                      </p>
                    )}
                  </div>
                  {capability.href && (
                    <span className="text-slate-600 text-xs shrink-0 group-hover:text-cyan-400 transition-colors">→</span>
                  )}
                </>
              );
              const classes = "flex items-start gap-3 rounded-xl bg-navy-950/60 border border-slate-800 p-4 text-left transition-all hover:border-cyan-400/30 group";
              return capability.href ? (
                <Link key={capability.label} href={capability.href} className={classes}>
                  {inner}
                </Link>
              ) : (
                <div key={capability.label} className={classes}>
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}