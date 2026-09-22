"use client";

import React from "react";
import { useDateTime } from "@/hooks/useDateTime";
import { useApp } from "@/context/AppContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { Wifi, WifiOff, Bell, Search, Mic } from "lucide-react";
import { HUDButton } from "../ui/HUDButton";

export function TopBar() {
  const { timeString, shortDateString } = useDateTime();
  const { isOnline, aiState } = useApp();
  const isMobile = useIsMobile();

  return (
    <header className="h-16 px-4 md:px-6 flex items-center justify-between border-b border-cyan-400/10 bg-navy-950/30 backdrop-blur-md sticky top-0 z-30">
      {/* Left side - Title / Context */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-3">
          <h1 className="font-display font-semibold text-slate-200 tracking-wide">
            LOCAL AI ASSISTANT
          </h1>
          <div className="h-4 w-px bg-slate-700" />
        </div>
        
        <div className="flex items-center gap-2">
          {isOnline ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded-md border border-slate-700/50">
              <Wifi size={12} className="text-emerald-400" />
              <span className="hidden sm:inline">Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/30 px-2 py-1 rounded-md border border-amber-500/20">
              <WifiOff size={12} />
              <span>Offline - Local Mode</span>
            </div>
          )}
        </div>
      </div>

      {/* Right side - Controls & Time */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Global Search (Hidden on very small screens) */}
        {!isMobile && (
          <div className="relative group mr-2">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={14} className="text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search JARVIS..."
              className="bg-navy-900/50 border border-slate-700/50 text-sm text-slate-200 rounded-full pl-9 pr-4 py-1.5 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 w-48 transition-all focus:w-64"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">⌘K</span>
            </div>
          </div>
        )}

        {/* Global Mic Button */}
        <HUDButton 
          variant={aiState.state === 'listening' ? 'default' : 'outline'} 
          size="icon" 
          className="rounded-full w-9 h-9 relative"
        >
          <Mic size={16} className={aiState.state === 'listening' ? 'animate-pulse' : ''} />
          {aiState.state === 'listening' && (
            <span className="absolute inset-0 rounded-full border border-cyan-400 animate-ping opacity-75"></span>
          )}
        </HUDButton>

        {/* Notifications */}
        <HUDButton variant="ghost" size="icon" className="w-9 h-9 relative text-slate-400">
          <Bell size={18} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-cyan-500 rounded-full" />
        </HUDButton>

        {/* Date/Time HUD */}
        <div className="flex flex-col items-end text-right ml-2 border-l border-slate-800 pl-4">
          <span className="font-mono text-sm text-cyan-400 font-medium tracking-wider">
            {timeString}
          </span>
          <span className="font-mono text-[10px] text-slate-500 tracking-widest uppercase">
            {shortDateString}
          </span>
        </div>
      </div>
    </header>
  );
}
