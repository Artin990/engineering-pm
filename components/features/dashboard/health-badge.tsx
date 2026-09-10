import { Badge } from "@/components/ui/badge";
import { PROJECT_HEALTH_LABEL, type ProjectHealth } from "@/components/features/types";

interface HealthBadgeProps {
  health: ProjectHealth;
  reason?: string;
}

const variantMap: Record<ProjectHealth, "success" | "warning" | "destructive" | "secondary"> = {
  on_track: "success",
  at_risk: "warning",
  off_track: "destructive",
  blocked: "secondary",
};

/**
 * Colour-coded health badge for project status.
 * Renders the Persian label from PROJECT_HEALTH_LABEL.
 */
export function HealthBadge({ health, reason }: HealthBadgeProps) {
  return (
    <div className="flex items-center gap-[8px]">
      <Badge variant={variantMap[health]}>
        {PROJECT_HEALTH_LABEL[health]}
      </Badge>
      {reason ? (
        <span className="text-[13px] text-[var(--text-muted)]">{reason}</span>
      ) : null}
    </div>
  );
}
