import React from "react";
import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
  status: "online" | "offline" | "processing" | "error";
  label?: string;
  pulse?: boolean;
  className?: string;
}

export function StatusIndicator({ status, label, pulse = true, className }: StatusIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "w-2 h-2 rounded-full",
          status === "online" && "bg-emerald-500",
          status === "offline" && "bg-slate-500",
          status === "processing" && "bg-cyan-400",
          status === "error" && "bg-red-500",
          pulse && status !== "offline" && "animate-pulse"
        )}
      >
        {pulse && status !== "offline" && (
          <div
            className={cn(
              "absolute w-2 h-2 rounded-full animate-ping opacity-75",
              status === "online" && "bg-emerald-400",
              status === "processing" && "bg-cyan-400",
              status === "error" && "bg-red-400"
            )}
          />
        )}
      </div>
      {label && <span className="text-xs font-medium tracking-wide text-slate-300">{label}</span>}
    </div>
  );
}
