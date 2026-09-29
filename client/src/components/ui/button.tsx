import React from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children?: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const baseStyles =
      "relative inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50 select-none overflow-hidden cursor-pointer";

    const variantStyles = {
      primary:
        "bg-primary text-background font-bold shadow-[0_2px_12px_rgba(223,171,108,0.2)] hover:shadow-[0_4px_20px_rgba(223,171,108,0.35)] hover:bg-primary/95 active:scale-[0.98]",
      secondary:
        "bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant/30 active:scale-[0.98]",
      outline:
        "border border-outline-variant/40 hover:border-primary/50 text-on-surface hover:bg-primary/10 active:scale-[0.98]",
      ghost:
        "text-on-surface-variant hover:text-on-surface hover:bg-surface-container active:scale-[0.98]",
      danger:
        "bg-error/15 hover:bg-error/25 text-error border border-error/30 active:scale-[0.98]",
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
      md: "h-10 px-4 text-xs font-semibold rounded-xl gap-2",
      lg: "h-12 px-6 text-sm font-semibold rounded-xl gap-2.5",
      icon: "h-9 w-9 p-0 rounded-lg justify-center",
    };

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: disabled ? 1 : 0.97 }}
        transition={{ type: "spring", stiffness: 450, damping: 25 }}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            ></path>
          </svg>
        )}
        {children}
      </motion.button>
    );
  }
);
Button.displayName = "Button";
