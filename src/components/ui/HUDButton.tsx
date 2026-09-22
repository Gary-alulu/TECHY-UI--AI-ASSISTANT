import React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-cyan-500 text-primary-foreground hover:bg-cyan-600 shadow-[0_0_15px_rgba(34,211,238,0.3)]",
        destructive: "bg-red-500 text-destructive-foreground hover:bg-red-600",
        outline: "border border-cyan-500/50 text-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/50 hover:border-cyan-400 hover:text-cyan-300",
        secondary: "bg-indigo-600 text-secondary-foreground hover:bg-indigo-700",
        ghost: "hover:bg-slate-800/50 hover:text-cyan-400 text-slate-300",
        link: "text-cyan-400 underline-offset-4 hover:underline",
        hud: "btn-hud",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const HUDButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
HUDButton.displayName = "HUDButton";
