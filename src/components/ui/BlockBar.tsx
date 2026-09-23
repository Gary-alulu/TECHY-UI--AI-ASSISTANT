import React from "react";
import { cn } from "@/lib/utils";

interface BlockBarProps {
  percentage: number;
  segments?: number;
  className?: string;
  filledClassName?: string;
  emptyClassName?: string;
}

/** A segmented status bar that renders like ██████░░░░ (10 blocks). */
export const BlockBar = React.memo(function BlockBar({
  percentage,
  segments = 10,
  className,
  filledClassName = "bg-cyan-400",
  emptyClassName = "bg-slate-800",
}: BlockBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(percentage)));
  const filled = Math.round((clamped / 100) * segments);
  const blocks = Array.from({ length: segments }, (_, index) => index < filled);

  return (
    <div className={cn("flex gap-0.5", className)}>
      {blocks.map((isFilled, index) => (
        <span
          key={index}
          className={cn(
            "h-full flex-1 rounded-[1px] transition-colors duration-500",
            isFilled ? filledClassName : emptyClassName
          )}
        />
      ))}
    </div>
  );
});