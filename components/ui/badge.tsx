import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-[4px] rounded-[10px] border px-[12px] py-[4px] text-[14px] font-medium tracking-[0] transition-[0.15s_ease-in-out] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--primary)] text-white shadow-sm hover:bg-[var(--primary-hover)]",
        secondary:
          "border-transparent bg-[var(--surface-raised)] text-[var(--text-primary)] hover:bg-[var(--surface)]",
        destructive:
          "border-transparent bg-[#dc2626] text-white shadow-sm hover:bg-[#b91c1c]",
        outline:
          "border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] hover:bg-[var(--surface)]",
        success:
          "border-transparent bg-[#16a34a] text-white shadow-sm hover:bg-[#15803d]",
        warning:
          "border-transparent bg-[#d97706] text-white shadow-sm hover:bg-[#b45309]",
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
