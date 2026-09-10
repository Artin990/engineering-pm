import { Bug, CircleDot, Search, Sparkles, TrendingUp, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ISSUE_TYPE_LABEL, type IssueType } from "@/components/features/types";

const MAP: Record<IssueType, typeof CircleDot> = {
  task: CircleDot,
  bug: Bug,
  feature: Sparkles,
  improvement: TrendingUp,
  chore: Wrench,
  research: Search,
};

export function IssueTypeBadge({ type }: { type: IssueType }) {
  const Icon = MAP[type];
  return (
    <Badge variant="secondary" className="gap-1 whitespace-nowrap">
      <Icon size={12} className="shrink-0" />
      {ISSUE_TYPE_LABEL[type]}
    </Badge>
  );
}
