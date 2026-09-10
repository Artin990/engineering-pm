import { CalendarDays, CircleDot, GitBranch, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { faDate, faNumber, faPercent } from "@/lib/format";
import {
  CYCLE_STATUS_LABEL,
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_ORDER,
  MILESTONE_STATUS_LABEL,
} from "@/components/features/types";
import {
  MOCK_CYCLES,
  MOCK_ISSUES,
  MOCK_MILESTONES,
} from "@/components/features/__fixtures__/mock-data";

const MILESTONE_DOT: Record<string, string> = {
  completed: "bg-emerald-500",
  active: "bg-[var(--primary)]",
  planned: "bg-[var(--text-muted)]",
};

const CYCLE_BADGE: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-600",
  active: "bg-[var(--primary)]/10 text-[var(--primary)]",
  planned: "bg-[var(--surface)] text-[var(--text-secondary)]",
};

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;

  const milestones = [...MOCK_MILESTONES].sort((a, b) => a.order - b.order);

  // Completion % per milestone from issues
  const milestoneStats = milestones.map((m) => {
    const issues = MOCK_ISSUES.filter((i) => i.milestoneId === m.id);
    const done = issues.filter((i) => i.status === "done").length;
    return {
      milestone: m,
      total: issues.length,
      done,
      pct: issues.length ? done / issues.length : 0,
    };
  });

  // Active cycle range for the highlighted band
  const activeCycle = MOCK_CYCLES.find((c) => c.status === "active");
  const allDates = [
    ...milestones.map((m) => m.targetDate).filter(Boolean),
    activeCycle?.startDate,
    activeCycle?.endDate,
  ]
    .filter(Boolean)
    .map((d) => new Date(d as string).getTime());
  const timelineStart = allDates.length ? Math.min(...allDates) : Date.now();
  const timelineEnd = allDates.length ? Math.max(...allDates) : Date.now() + 1;
  const span = timelineEnd - timelineStart || 1;
  const pctOf = (d: string) =>
    ((new Date(d).getTime() - timelineStart) / span) * 100;

  const cycleIssues = (cycleId: string) =>
    MOCK_ISSUES.filter((i) => i.cycleId === cycleId);

  return (
    <div className="flex flex-col gap-[20px] p-[20px]">
      {/* Page header */}
      <div>
        <h1 className="text-[18px] font-bold text-[var(--text-primary)]">رودمپ</h1>
        <p className="mt-1 text-[14px] text-[var(--text-muted)]">
          نمای زمانی مایلستون‌ها و سایکل‌های پروژه {key}
        </p>
      </div>

      {/* ===== Horizontal timeline ===== */}
      <Card>
        <CardHeader>
          <CardTitle>تایم‌لاین مایلستون‌ها</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative pt-[40px] pb-[28px]">
            {/* Active cycle highlighted range */}
            {activeCycle && (
              <div
                className="absolute top-[28px] h-[10px] rounded-full bg-[var(--primary)]/15 ring-1 ring-[var(--primary)]/30"
                style={{
                  insetInlineStart: `${pctOf(activeCycle.startDate)}%`,
                  width: `${pctOf(activeCycle.endDate) - pctOf(activeCycle.startDate)}%`,
                }}
                title={`سایکل جاری: ${activeCycle.name}`}
              />
            )}

            {/* Base line */}
            <div className="absolute top-[32px] h-[3px] w-full rounded-full bg-[var(--border)]" />

            {/* Milestone markers along the line */}
            {milestoneStats.map(({ milestone, pct }) => {
              const pos = milestone.targetDate
                ? Math.min(Math.max(pctOf(milestone.targetDate), 5), 95)
                : null;
              return (
                <div
                  key={milestone.id}
                  className="absolute top-0 flex w-[120px] -translate-x-1/2 rtl:translate-x-1/2 flex-col items-center text-center"
                  style={
                    pos !== null
                      ? { insetInlineStart: `${pos}%` }
                      : { position: "relative", marginInlineStart: "8px" }
                  }
                >
                  <span className="mb-[6px] text-[11px] font-medium text-[var(--text-muted)]" dir="rtl">
                    {milestone.targetDate ? faDate(milestone.targetDate) : "—"}
                  </span>
                  <span
                    className={cn(
                      "z-10 inline-block h-[14px] w-[14px] rounded-full border-2 border-[var(--surface)] shadow-xs",
                      MILESTONE_DOT[milestone.status]
                    )}
                  />
                  <span className="mt-[6px] line-clamp-1 text-[12px] font-semibold text-[var(--text-primary)]">
                    {milestone.title}
                  </span>
                  <span className="mt-[2px] text-[11px] text-[var(--text-muted)]">
                    {faPercent(pct)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Milestone cards (connected row) */}
          <div className="mt-[20px] grid gap-[12px] md:grid-cols-3">
            {milestoneStats.map(({ milestone, total, done, pct }, idx) => (
              <div key={milestone.id} className="relative">
                {/* CSS connecting lines between milestone cards */}
                {idx < milestoneStats.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute top-1/2 -end-[12px] hidden h-[2px] w-[12px] bg-[var(--border)] md:block"
                  />
                )}
                <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-[12px]">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[14px] font-semibold leading-6 text-[var(--text-primary)]">
                      {milestone.title}
                    </h3>
                    <Badge
                      variant="secondary"
                      className={cn("shrink-0", CYCLE_BADGE[milestone.status])}
                    >
                      {MILESTONE_STATUS_LABEL[milestone.status]}
                    </Badge>
                  </div>
                  <div className="mt-[8px] flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--text-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays size={12} />
                      {milestone.targetDate ? faDate(milestone.targetDate) : "—"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CircleDot size={12} />
                      {faNumber(total)} ایشو ({faNumber(done)} انجام‌شده)
                    </span>
                  </div>
                  {/* Completion */}
                  <div className="mt-[8px]">
                    <div className="flex items-center justify-between text-[12px] text-[var(--text-muted)]">
                      <span>پیشرفت</span>
                      <span>{faPercent(pct)}</span>
                    </div>
                    <div className="mt-[4px] h-[6px] w-full overflow-hidden rounded-full bg-[var(--border)]">
                      <div
                        className="h-full rounded-full bg-[var(--primary)]"
                        style={{ width: `${Math.round(pct * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ===== Cycle cards ===== */}
      <div className="flex flex-col gap-[12px]">
        <h2 className="text-[16px] font-bold text-[var(--text-primary)]">سایکل‌ها</h2>
        <div className="grid gap-[12px] md:grid-cols-2 lg:grid-cols-3">
          {MOCK_CYCLES.map((c) => {
            const issues = cycleIssues(c.id);
            const byStatus = ISSUE_STATUS_ORDER.map((s) => ({
              status: s,
              count: issues.filter((i) => i.status === s).length,
            })).filter((x) => x.count > 0);
            return (
              <Card key={c.id} className={cn(c.status === "active" && "ring-1 ring-[var(--primary)]")}>
                <CardHeader className="pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="inline-flex items-center gap-2">
                      <Target size={16} className="text-[var(--primary)]" />
                      {c.name}
                    </CardTitle>
                    <Badge
                      variant="secondary"
                      className={cn("shrink-0", CYCLE_BADGE[c.status])}
                    >
                      {CYCLE_STATUS_LABEL[c.status]}
                    </Badge>
                  </div>
                  <p className="text-[12px] text-[var(--text-muted)]" dir="rtl">
                    {faDate(c.startDate)} — {faDate(c.endDate)}
                  </p>
                </CardHeader>
                <CardContent className="pt-[12px]">
                  {c.goal && (
                    <p className="text-[14px] leading-6 text-[var(--text-secondary)]">
                      {c.goal}
                    </p>
                  )}
                  {/* Progress bar */}
                  <div className="mt-[12px]">
                    <div className="flex items-center justify-between text-[12px] text-[var(--text-muted)]">
                      <span>پیشرفت</span>
                      <span>{faPercent(c.progress ?? 0)}</span>
                    </div>
                    <div className="mt-[4px] h-[6px] w-full overflow-hidden rounded-full bg-[var(--border)]">
                      <div
                        className="h-full rounded-full bg-[var(--primary)]"
                        style={{ width: `${Math.round((c.progress ?? 0) * 100)}%` }}
                      />
                    </div>
                  </div>
                  {/* Issue counts by status */}
                  <div className="mt-[12px] flex flex-wrap gap-[6px]">
                    {byStatus.length === 0 ? (
                      <span className="text-[12px] text-[var(--text-muted)]">
                        ایشویی در این سایکل نیست
                      </span>
                    ) : (
                      byStatus.map(({ status, count }) => (
                        <Badge key={status} variant="outline" className="text-[11px]">
                          {ISSUE_STATUS_LABEL[status]}: {faNumber(count)}
                        </Badge>
                      ))
                    )}
                  </div>
                  <div className="mt-[12px] flex items-center gap-1 text-[12px] text-[var(--text-muted)]">
                    <GitBranch size={12} />
                    {faNumber(c.doneEstimate ?? 0)} از {faNumber(c.totalEstimate ?? 0)}{" "}
                    امتیاز
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
