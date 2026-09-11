import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-[6px] border px-2.5 py-0.5 text-[11px] sm:text-[12px] font-medium leading-normal transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--primary)] text-white shadow-xs hover:bg-[var(--primary-hover)]",
        secondary:
          "border-transparent bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface)]",
        destructive:
          "border-transparent bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20",
        outline:
          "border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] hover:bg-[var(--surface-raised)]",
        success:
          "border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        warning:
          "border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
