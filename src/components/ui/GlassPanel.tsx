import React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const glassPanelVariants = cva("rounded-xl transition-all duration-300", {
  variants: {
    variant: {
      default: "glass-panel",
      elevated: "glass-panel-elevated",
      interactive: "glass-panel-interactive",
      ghost: "bg-transparent border border-transparent",
    },
    glow: {
      none: "",
      cyan: "glow-cyan hover:glow-cyan-strong",
      violet: "glow-violet",
    },
    padding: {
      none: "p-0",
      sm: "p-3",
      md: "p-5",
      lg: "p-8",
    },
  },
  defaultVariants: {
    variant: "default",
    glow: "none",
    padding: "md",
  },
});

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof glassPanelVariants> {
  header?: React.ReactNode;
  headerAction?: React.ReactNode;
  hudCorners?: boolean;
}

export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, variant, glow, padding, header, headerAction, hudCorners, children, ...props }, ref) => {
    const hasHeader = Boolean(header || headerAction);
    return (
      <div
        ref={ref}
        className={cn(glassPanelVariants({ variant, glow, padding }), hasHeader && "flex flex-col", hudCorners && "hud-corner", className)}
        {...props}
      >
        {hasHeader && (
          <div className={cn("flex items-center justify-between shrink-0", padding === "none" ? "p-4 pb-0" : "mb-4")}>
            {header && (
              <div className="text-display text-sm font-semibold tracking-wider text-cyan-400 uppercase">
                {header}
              </div>
            )}
            {headerAction && <div>{headerAction}</div>}
          </div>
        )}
        {hasHeader ? <div className="flex flex-1 flex-col min-h-0">{children}</div> : children}
      </div>
    );
  }
);
GlassPanel.displayName = "GlassPanel";
