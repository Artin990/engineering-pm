import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-[13px] sm:text-[14px] leading-normal font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--primary)] text-white shadow-xs hover:bg-[var(--primary-hover)]",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90",
        outline:
          "border border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] shadow-xs hover:bg-[var(--surface-raised)]",
        secondary:
          "bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border)] shadow-xs hover:bg-[var(--surface)]",
        ghost: "text-[var(--text-primary)] hover:bg-[var(--surface-raised)]",
        link: "text-[var(--primary)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8.5 rounded-[8px] px-3 py-1 text-[12px] sm:text-[13px]",
        lg: "h-11 rounded-[12px] px-6 py-2.5 text-[14px] sm:text-[15px]",
        icon: "size-10 rounded-[10px]",
        "icon-sm": "size-8.5 rounded-[8px]",
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

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
