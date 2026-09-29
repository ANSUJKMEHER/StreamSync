import React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "outline" | "primary";
  dot?: boolean;
}

export function Badge({
  className,
  variant = "default",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: "bg-surface-container-high text-on-surface-variant border-outline-variant/30",
    primary: "bg-primary/15 text-primary border-primary/25 shadow-[0_0_12px_rgba(223,171,108,0.15)]",
    success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    warning: "bg-amber-500/15 text-amber-300 border-amber-500/25",
    error: "bg-rose-500/15 text-rose-400 border-rose-500/25",
    outline: "bg-transparent text-on-surface border-outline-variant/40",
  };

  const dotStyles = {
    default: "bg-on-surface-variant",
    primary: "bg-primary animate-pulse",
    success: "bg-emerald-400 animate-pulse",
    warning: "bg-amber-300 animate-pulse",
    error: "bg-rose-400 animate-pulse",
    outline: "bg-on-surface",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border tracking-wider uppercase transition-colors select-none",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dotStyles[variant])} />}
      {children}
    </span>
  );
}
