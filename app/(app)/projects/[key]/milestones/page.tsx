"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { faDate, faNumber, faPercent } from "@/lib/format";
import {
  ISSUE_STATUS_LABEL,
  MILESTONE_STATUS_LABEL,
  type Issue,
  type Milestone,
  type MilestoneStatus,
} from "@/components/features/types";

const STATUS_BADGE: Record<MilestoneStatus, string> = {
  completed: "bg-emerald-500/10 text-emerald-600",
  active: "bg-[var(--primary)]/10 text-[var(--primary)]",
  planned: "bg-[var(--surface)] text-[var(--text-secondary)]",
};

function MilestoneCard({
  milestone,
  issues,
  expanded,
  onToggle,
}: {
  milestone: Milestone;
  issues: Issue[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const done = issues.filter((i) => i.status === "done").length;
  const pct = issues.length ? done / issues.length : 0;

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-[12px] p-[20px] text-start"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">
              {milestone.title}
            </h3>
            {milestone.description && (
              <p className="mt-1 text-[14px] leading-6 text-[var(--text-muted)]">
                {milestone.description}
              </p>
            )}
          </div>
          <Badge
            variant="secondary"
            className={cn("shrink-0", STATUS_BADGE[milestone.status])}
          >
            {MILESTONE_STATUS_LABEL[milestone.status]}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-[var(--text-secondary)]">
          <span>سررسید: {milestone.targetDate ? faDate(milestone.targetDate) : "—"}</span>
          <span>{faNumber(issues.length)} ایشو</span>
          <span>{faNumber(done)} انجام‌شده</span>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between text-[12px] text-[var(--text-muted)]">
            <span>پیشرفت</span>
            <span>{faPercent(pct)}</span>
          </div>
          <div className="mt-[4px] h-[6px] w-full overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-[0.15s_ease-in-out]"
              style={{ width: `${Math.round(pct * 100)}%` }}
            />
          </div>
        </div>

        <span className="inline-flex items-center gap-1 text-[12px] text-[var(--primary)]">
          {expanded ? (
            <>
              بستن <ChevronUp size={14} />
            </>
          ) : (
            <>
              نمایش ایشوها <ChevronDown size={14} />
            </>
          )}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border)] p-[20px] pt-[12px]">
          {issues.length === 0 ? (
            <p className="text-[14px] text-[var(--text-muted)]">
              ایشویی در این مایلستون ثبت نشده است.
            </p>
          ) : (
            <ul className="flex flex-col gap-[8px]">
              {issues.map((issue) => (
                <li
                  key={issue.id}
                  className="flex items-center justify-between gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--background)] p-[12px]"
                >
                  <div className="min-w-0">
                    <span
                      dir="ltr"
                      className="me-2 text-[12px] font-bold text-[var(--text-muted)]"
                    >
                      {issue.key}
                    </span>
                    <span className="text-[14px] text-[var(--text-primary)]">
                      {issue.title}
                    </span>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {ISSUE_STATUS_LABEL[issue.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function MilestonesPage() {
  // Mock data — replaced by real queries in a later wave
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Simulated fetch
  useMemo(() => {
    import("@/components/features/__fixtures__/mock-data").then(
      ({ MOCK_ISSUES, MOCK_MILESTONES }) => {
        setTimeout(() => {
          setMilestones([...MOCK_MILESTONES].sort((a, b) => a.order - b.order));
          setIssues(MOCK_ISSUES);
          setLoading(false);
        }, 500);
      }
    );
  }, []);

  const retry = () => {
    setError(false);
    setLoading(true);
    setTimeout(() => setLoading(false), 400);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 p-[40px] text-center">
        <AlertCircle size={24} className="text-red-500" />
        <p className="text-[14px] text-[var(--text-secondary)]">
          خطا در بارگذاری مایلستون‌ها
        </p>
        <Button onClick={retry}>تلاش مجدد</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid gap-[12px] p-[20px] md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[180px] rounded-[10px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[16px] p-[20px]">
      <div>
        <h1 className="text-[18px] font-bold text-[var(--text-primary)]">
          مایلستون‌ها
        </h1>
        <p className="mt-1 text-[14px] text-[var(--text-muted)]">
          نقاط عطف پروژه و پیشرفت هر کدام
        </p>
      </div>

      {milestones.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-[40px] text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--background)] text-[var(--text-muted)]">
            <Inbox size={22} />
          </span>
          <div>
            <p className="font-semibold text-[var(--text-primary)]">
              مایلستونی یافت نشد
            </p>
            <p className="mt-1 text-[14px] text-[var(--text-muted)]">
              اولین مایلستون پروژه را بسازید.
            </p>
          </div>
          <Button>ساخت مایلستون</Button>
        </div>
      ) : (
        <div className="grid gap-[12px] md:grid-cols-2">
          {milestones.map((m) => (
            <MilestoneCard
              key={m.id}
              milestone={m}
              issues={issues.filter((i) => i.milestoneId === m.id)}
              expanded={expandedId === m.id}
              onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
