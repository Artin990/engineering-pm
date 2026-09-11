import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, dir, ...props }, ref) => {
  return (
    <input
      type={type}
      dir={dir || "rtl"}
      className={cn(
        "flex h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--background)] px-3.5 py-2 text-[13px] sm:text-[14px] leading-normal font-medium text-[var(--text-primary)] text-start shadow-xs transition-colors placeholder:text-[var(--text-muted)] placeholder:text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
