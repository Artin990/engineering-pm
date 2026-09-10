import { AlertCircle, ArrowDown, ArrowUp, Circle, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IssuePriority } from "@/components/features/types";

const MAP: Record<IssuePriority, { Icon: typeof Circle; className: string }> = {
  urgent: { Icon: AlertCircle, className: "text-red-500" },
  high: { Icon: ArrowUp, className: "text-orange-500" },
  medium: { Icon: Minus, className: "text-yellow-500" },
  low: { Icon: ArrowDown, className: "text-blue-500" },
  none: { Icon: Circle, className: "text-[var(--text-muted)]" },
};

export function IssuePriorityIcon({
  priority,
  className,
  size = 14,
}: {
  priority: IssuePriority;
  className?: string;
  size?: number;
}) {
  const { Icon, className: color } = MAP[priority];
  return <Icon size={size} className={cn("shrink-0", color, className)} />;
}
