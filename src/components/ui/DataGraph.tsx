"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

interface DataGraphProps {
  data: number[];
  color?: string;
  fillColor?: string;
  height?: number;
  min?: number;
  max?: number;
  className?: string;
}

export function DataGraph({
  data,
  color = "text-cyan-400",
  fillColor = "text-cyan-900",
  height = 40,
  min = 0,
  max = 100,
  className,
}: DataGraphProps) {
  const points = useMemo(() => {
    if (!data || data.length === 0) return "";
    
    const range = max - min;
    const stepX = 100 / (data.length - 1 || 1);
    
    return data
      .map((val, i) => {
        const x = i * stepX;
        const boundedVal = Math.min(Math.max(val, min), max);
        const y = 100 - ((boundedVal - min) / range) * 100;
        return `${x},${y}`;
      })
      .join(" ");
  }, [data, min, max]);

  if (!data || data.length === 0) {
    return <div className={cn("w-full opacity-30 bg-slate-800/50 rounded", className)} style={{ height }} />;
  }

  return (
    <div className={cn("w-full relative overflow-hidden", className)} style={{ height }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <polygon
          points={`0,100 ${points} 100,100`}
          className={cn("fill-current opacity-20", fillColor)}
        />
        <polyline
          points={points}
          fill="none"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          className={cn("stroke-current transition-all duration-300", color)}
        />
      </svg>
    </div>
  );
}
