"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Terminal, Box, Search, FileText } from "lucide-react";

export function AIGreeting() {
  const { aiState } = useApp();

  const [hour, setHour] = useState(-1);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setHour(new Date().getHours()));
    return () => cancelAnimationFrame(frame);
  }, []);

  let greeting = "";
  if (hour >= 5 && hour < 12) greeting = "Good morning.";
  else if (hour >= 12 && hour < 17) greeting = "Good afternoon.";
  else if (hour >= 0) greeting = "Good evening.";

  const getIconForTool = (toolName?: string) => {
    if (!toolName) return null;
    if (toolName.toLowerCase().includes('system') || toolName.toLowerCase().includes('terminal')) return <Terminal size={14} />;
    if (toolName.toLowerCase().includes('file') || toolName.toLowerCase().includes('search')) return <Search size={14} />;
    if (toolName.toLowerCase().includes('document')) return <FileText size={14} />;
    return <Box size={14} />;
  };

  return (
    <div className="flex flex-col items-center text-center mt-8 min-h-[80px]">
      <AnimatePresence mode="wait">
        {aiState.state === 'idle' ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-2"
          >
            <h2 className="text-2xl font-display font-medium text-slate-100 tracking-wide">
              {greeting}
            </h2>
            <div className="text-sm font-mono text-cyan-400/80 tracking-widest uppercase">
              {aiState.label}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center gap-3"
          >
            <div className={cn(
              "text-lg font-display tracking-wide flex items-center gap-3",
              aiState.state === 'thinking' && "text-violet-400",
              aiState.state === 'listening' && "text-cyan-400",
              aiState.state === 'executing' && "text-emerald-400",
              aiState.state === 'error' && "text-red-400",
              aiState.state === 'speaking' && "text-cyan-300"
            )}>
              {/* Pulsing indicator dot */}
              <div className="relative flex h-2 w-2">
                <span className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  aiState.state === 'thinking' && "bg-violet-400",
                  aiState.state === 'listening' && "bg-cyan-400",
                  aiState.state === 'executing' && "bg-emerald-400",
                  aiState.state === 'error' && "bg-red-400",
                  aiState.state === 'speaking' && "bg-cyan-400"
                )}></span>
                <span className={cn(
                  "relative inline-flex rounded-full h-2 w-2",
                  aiState.state === 'thinking' && "bg-violet-500",
                  aiState.state === 'listening' && "bg-cyan-500",
                  aiState.state === 'executing' && "bg-emerald-500",
                  aiState.state === 'error' && "bg-red-500",
                  aiState.state === 'speaking' && "bg-cyan-500"
                )}></span>
              </div>
              
              {aiState.label}
            </div>
            
            {/* Tool Execution Detail */}
            {aiState.state === 'executing' && aiState.toolName && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 text-xs font-mono uppercase tracking-wider">
                {getIconForTool(aiState.toolName)}
                <span>{aiState.toolName}</span>
                <span className="w-4 flex overflow-hidden">
                  <motion.span
                    animate={{ x: [0, 16] }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  >
                    ...
                  </motion.span>
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
