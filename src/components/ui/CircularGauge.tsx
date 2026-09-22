import React from "react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./AnimatedNumber";

interface CircularGaugeProps {
  percentage: number;
  label: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function CircularGauge({
  percentage,
  label,
  size = 120,
  strokeWidth = 8,
  color = "text-cyan-400",
  trackColor = "text-slate-800",
  icon,
  className,
}: CircularGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const safePercentage = Math.min(Math.max(percentage, 0), 100);
  const strokeDashoffset = circumference - (safePercentage / 100) * circumference;

  return (
    <div className={cn("relative flex flex-col items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="transparent"
          className={cn("stroke-current", trackColor)}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={cn("stroke-current transition-all duration-1000 ease-out", color)}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {icon && <div className="mb-1 text-slate-400">{icon}</div>}
        <div className="flex items-baseline gap-0.5">
          <span className="text-xl font-bold text-slate-100 text-metric">
            <AnimatedNumber value={percentage} />
          </span>
          <span className="text-xs text-slate-400">%</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">{label}</span>
      </div>
    </div>
  );
}
