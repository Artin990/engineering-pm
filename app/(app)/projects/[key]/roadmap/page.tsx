"use client";

import { use } from "react";
import { CalendarDays, CircleDot, GitBranch, Target, Map } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { faDate, faNumber, faPercent } from "@/lib/format";
import { useProjectStore } from "@/lib/project-store";
import {
  CYCLE_STATUS_LABEL,
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_ORDER,
  MILESTONE_STATUS_LABEL,
} from "@/components/features/types";

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

export default function RoadmapPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = use(params);
  const { milestones, cycles, issues } = useProjectStore();

  const sortedMilestones = [...milestones].sort((a, b) => a.order - b.order);

  // Completion % per milestone from issues
  const milestoneStats = sortedMilestones.map((m) => {
    const mIssues = issues.filter((i) => i.milestoneId === m.id);
    const done = mIssues.filter((i) => i.status === "done").length;
    return {
      milestone: m,
      total: mIssues.length,
      done,
      pct: mIssues.length ? done / mIssues.length : 0,
    };
  });

  // Active cycle range for the highlighted band
  const activeCycle = cycles.find((c) => c.status === "active");
  const allDates = [
    ...sortedMilestones.map((m) => m.targetDate).filter(Boolean),
    activeCycle?.startDate,
    activeCycle?.endDate,
  ]
    .filter(Boolean)
    .map((d) => new Date(d as string).getTime());
  const timelineStart = allDates.length ? Math.min(...allDates) : Date.now();
  const timelineEnd = allDates.length ? Math.max(...allDates) : Date.now() + 86400000;
  const span = timelineEnd - timelineStart || 1;
  const pctOf = (d: string) =>
    Math.min(100, Math.max(0, ((new Date(d).getTime() - timelineStart) / span) * 100));

  const cycleIssues = (cycleId: string) =>
    issues.filter((i) => i.cycleId === cycleId);

  return (
    <div className="flex flex-col gap-[20px] p-[20px] max-w-6xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-[18px] font-bold text-[var(--text-primary)]">رودمپ</h1>
        <p className="mt-1 text-[14px] text-[var(--text-muted)]">
          نمای زمانی مایلستون‌ها و سایکل‌های پروژه {key}
        </p>
      </div>

      {sortedMilestones.length === 0 && cycles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[12px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-[48px] text-center">
          <Map className="size-12 text-[var(--text-muted)] mb-3" />
          <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">
            رودمپ پروژه هنوز شکل نگرفته است
          </h3>
          <p className="text-[13px] text-[var(--text-muted)] mt-1 max-w-sm">
            با ساخت اولین سایکل یا مایلستون، تایم‌لاین بصری پروژه در این بخش ترسیم می‌شود.
          </p>
        </div>
      ) : (
        <>
          {/* ===== Horizontal timeline ===== */}
          {sortedMilestones.length > 0 && (
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
                        width: `${Math.max(5, pctOf(activeCycle.endDate) - pctOf(activeCycle.startDate))}%`,
                      }}
                      title={`سایکل جاری: ${activeCycle.name}`}
                    />
                  )}

                  {/* Base line */}
                  <div className="absolute top-[32px] h-[3px] w-full rounded-full bg-[var(--border)]" />

                  {/* Milestone markers */}
                  <div className="relative flex justify-between">
                    {sortedMilestones.map((milestone, idx) => {
                      const pos = milestone.targetDate
                        ? Math.min(Math.max(pctOf(milestone.targetDate), 5), 95)
                        : (idx / (sortedMilestones.length - 1 || 1)) * 90 + 5;

                      return (
                        <div
                          key={milestone.id}
                          className="absolute flex flex-col items-center -translate-x-1/2"
                          style={{ insetInlineStart: `${pos}%` }}
                        >
                          {/* Dot on line */}
                          <span
                            className={cn(
                              "size-[14px] rounded-full border-2 border-[var(--surface)] shadow-xs transition-transform hover:scale-125",
                              MILESTONE_DOT[milestone.status] ?? "bg-[var(--text-muted)]"
                            )}
                          />

                          {/* Target date */}
                          <span className="mt-[6px] text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                            {milestone.targetDate ? faDate(milestone.targetDate) : "—"}
                          </span>

                          {/* Title */}
                          <span className="mt-[2px] max-w-[100px] truncate text-center text-[12px] font-medium text-[var(--text-primary)]">
                            {milestone.title}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ===== Milestones list ===== */}
          <div className="flex flex-col gap-[12px]">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">مایلستون‌ها</h2>
            <div className="grid gap-[12px] md:grid-cols-2">
              {milestoneStats.map(({ milestone, total, done, pct }) => (
                <Card key={milestone.id}>
                  <CardHeader className="pb-[8px]">
                    <div className="flex items-start justify-between gap-[8px]">
                      <div className="flex items-center gap-[8px]">
                        <span
                          className={cn(
                            "size-[10px] rounded-full",
                            MILESTONE_DOT[milestone.status] ?? "bg-[var(--text-muted)]"
                          )}
                        />
                        <CardTitle className="text-[14px]">{milestone.title}</CardTitle>
                      </div>
                      <Badge variant="secondary" className="text-[11px]">
                        {MILESTONE_STATUS_LABEL[milestone.status]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-[10px]">
                    {milestone.description && (
                      <p className="text-[12px] text-[var(--text-muted)]">
                        {milestone.description}
                      </p>
                    )}

                    {/* Progress bar */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                        <span>پیشرفت</span>
                        <span>{faPercent(pct)}</span>
                      </div>
                      <div className="mt-[4px] h-[6px] w-full overflow-hidden rounded-full bg-[var(--border)]">
                        <div
                          className="h-full rounded-full bg-[var(--primary)] transition-[width_0.4s_ease-in-out]"
                          style={{ width: `${Math.round(pct * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[12px] text-[var(--text-secondary)]">
                      <span className="flex items-center gap-[4px]">
                        <CalendarDays size={13} className="text-[var(--text-muted)]" />
                        {milestone.targetDate ? faDate(milestone.targetDate) : "بدون تاریخ"}
                      </span>
                      <span>
                        {faNumber(done)} از {faNumber(total)} ایشو
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* ===== Cycles section ===== */}
          <div className="flex flex-col gap-[12px]">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">سایکل‌ها</h2>
            <div className="flex flex-col gap-[12px]">
              {cycles.map((cycle) => {
                const cIssues = cycleIssues(cycle.id);
                const doneIssues = cIssues.filter((i) => i.status === "done");
                const progress = cIssues.length ? doneIssues.length / cIssues.length : cycle.progress ?? 0;

                return (
                  <Card key={cycle.id}>
                    <CardHeader className="pb-[8px]">
                      <div className="flex flex-wrap items-center justify-between gap-[8px]">
                        <div className="flex items-center gap-[8px]">
                          <GitBranch size={16} className="text-[var(--primary)]" />
                          <CardTitle className="text-[14px]">{cycle.name}</CardTitle>
                        </div>
                        <Badge
                          variant="secondary"
                          className={cn("text-[11px]", CYCLE_BADGE[cycle.status])}
                        >
                          {CYCLE_STATUS_LABEL[cycle.status]}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-[12px]">
                      <div className="flex flex-wrap items-center gap-x-[16px] gap-y-[4px] text-[12px] text-[var(--text-muted)]">
                        <span>
                          {faDate(cycle.startDate)} — {faDate(cycle.endDate)}
                        </span>
                        {cycle.goal && (
                          <span className="text-[var(--text-secondary)]">
                            هدف: {cycle.goal}
                          </span>
                        )}
                        <span>
                          {faNumber(cIssues.length)} ایشو ({faNumber(doneIssues.length)} انجام‌شده)
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                          <span>پیشرفت</span>
                          <span>{faPercent(progress)}</span>
                        </div>
                        <div className="mt-[4px] h-[6px] w-full overflow-hidden rounded-full bg-[var(--border)]">
                          <div
                            className="h-full rounded-full bg-[var(--primary)] transition-[width_0.4s_ease-in-out]"
                            style={{ width: `${Math.round(progress * 100)}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
