"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ThinkingIndicatorProps {
  label?: string;
  className?: string;
}

export function ThinkingIndicator({ label = "Thinking", className }: ThinkingIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="text-sm font-mono text-cyan-400 tracking-wider uppercase">
        {label}
      </span>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-cyan-400"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}
