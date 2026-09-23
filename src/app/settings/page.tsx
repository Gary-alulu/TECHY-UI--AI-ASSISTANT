"use client";

import React, { useState } from "react";
import { AIModelPanel } from "@/components/dashboard/AIModelPanel";
import { MemoryPanel } from "@/components/settings/MemoryPanel";
import { PersonalizationPanel } from "@/components/personalize/PersonalizationPanel";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Settings as SettingsIcon, Shield, Server, Monitor, Brain, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsTab = "provider" | "memory" | "personalize";

const NAV_ITEMS: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
  { id: "provider", label: "AI Provider", icon: <Server size={18} /> },
  { id: "memory", label: "Memory", icon: <Brain size={18} /> },
  { id: "personalize", label: "Personalization", icon: <Palette size={18} /> },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("provider");

  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">Settings</h2>
        <p className="text-sm text-slate-400 mt-1">Configure TECHY and local integrations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[700px]">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <GlassPanel className="h-full p-4">
            <nav className="space-y-2">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-left",
                    tab === item.id
                      ? "bg-cyan-950/30 text-cyan-400 border border-cyan-400/20"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border border-transparent"
                  )}
                >
                  {item.icon}
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
              <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:text-slate-400 hover:bg-slate-800/30 rounded-md border border-transparent cursor-not-allowed" title="Coming soon">
                <Shield size={18} />
                <span className="text-sm font-medium">Permissions</span>
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:text-slate-400 hover:bg-slate-800/30 rounded-md border border-transparent cursor-not-allowed" title="Coming soon">
                <Monitor size={18} />
                <span className="text-sm font-medium">Appearance</span>
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:text-slate-400 hover:bg-slate-800/30 rounded-md border border-transparent cursor-not-allowed" title="Coming soon">
                <SettingsIcon size={18} />
                <span className="text-sm font-medium">General</span>
              </a>
            </nav>
          </GlassPanel>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 flex flex-col gap-6 min-h-0">
          {tab === "provider" && (
            <>
              <div>
                <AIModelPanel />
              </div>
              <GlassPanel header="Local API Settings" className="flex-1 overflow-y-auto">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Ollama Endpoint</label>
                      <input
                        type="text"
                        defaultValue="http://localhost:11434"
                        readOnly
                        className="w-full bg-navy-950/80 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Default Model</label>
                      <select className="w-full bg-navy-950/80 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 appearance-none">
                        <option>Auto (first local model)</option>
                        <option disabled>— when Ollama is running —</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    TECHY negotiates models automatically from your installed Ollama models. Start Ollama and it will be picked up
                    automatically; between launches, offline skills handle system, files, apps, tasks and memory.
                  </p>
                </div>
              </GlassPanel>
            </>
          )}

          {tab === "memory" && (
            <div className="flex-1 min-h-0">
              <MemoryPanel />
            </div>
          )}

          {tab === "personalize" && (
            <div className="flex-1 overflow-y-auto pr-1">
              <PersonalizationPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}