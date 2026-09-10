/**
 * آنالیتیکس — OpenClaw (موج ۲).
 *
 * متریک‌ها: completion rate، cycle velocity، cycle time، lead time،
 * PR throughput، زمان ریویو، work distribution، burndown سایکل.
 *
 * ❌ متریک‌های ونتی (تعداد خام کامیت برای سنجش فرد) پیاده نمی‌شود.
 * هر عدد خروجی قابل ردیابی به کوئری منبع است (کامنت «منبع:» روی هر تابع).
 */

import type { IssueStatus } from "@/lib/progress";

// ─── Types ──────────────────────────────────────────────────────

export interface IssueForAnalytics {
  id: string;
  status: IssueStatus;
  estimate: number;
  assigneeId: string | null;
  cycleId: string | null;
  createdAt: Date;
  /** زمان شروع کار واقعی (وضعیت → in_progress) — اگر نگهداری نمی‌شود null */
  startedAt?: Date | null;
  /** closedAt فقط برای status=done */
  closedAt: Date | null;
}

export interface PullRequestForAnalytics {
  id: string;
  state: "open" | "closed" | "merged" | "draft";
  authorId: string | null;
  githubCreatedAt: Date | null;
  mergedAt: Date | null;
  closedAt: Date | null;
}

export interface ReviewForAnalytics {
  pullRequestId: string;
  reviewerId: string | null;
  /** APPROVED | CHANGES_REQUESTED | COMMENTED — در DB nullable است */
  state: string | null;
  submittedAt: Date | null;
}

// ─── Completion Rate ────────────────────────────────────────────

/**
 * نسبت ایشوهای done به کل ایشوهای فعال (بدون cancelled).
 * منبع: SELECT status, count(*) FROM issues WHERE project_id=? AND deleted_at IS NULL GROUP BY status
 * توجه: این «تعداد خام» است و فقط برای نمایش ساده؛ سنجش واقعی پیشرفت
 * باید از computeCompletion وزنی استفاده کند.
 */
export function completionRate(
  doneCount: number,
  activeCount: number
): number {
  if (activeCount <= 0) return 0;
  return doneCount / activeCount;
}

// ─── Cycle Velocity ─────────────────────────────────────────────

/**
 * ولاسیتی سایکل: مجموع استوری‌پوینت ایشوهای done در هر سایکل.
 * منبع: SELECT cycle_id, SUM(estimate) FROM issues WHERE status='done' AND closed_at BETWEEN ? AND ? GROUP BY cycle_id
 * ⚠️ استوری‌پوینت معیار ولاسیتی است، نه تعداد خام ایشو.
 */
export function cycleVelocity(
  issues: Array<Pick<IssueForAnalytics, "estimate" | "cycleId" | "status">>,
  cycleId: string
): number {
  return issues
    .filter((i) => i.cycleId === cycleId && i.status === "done")
    .reduce((sum, i) => sum + Math.max(i.estimate, 0), 0);
}

// ─── Cycle Time (تکمیل یک ایشو) ────────────────────────────────

/**
 * میانگین زمان تکمیل ایشو: از created_at تا closed_at (فقط done ها).
 * منبع: SELECT AVG(closed_at - created_at) FROM issues WHERE status='done' AND project_id=?
 * ⚠️ اگر startedAt نگهداری می‌شود، بهتر است از آن استفاده شود (زمان کار واقعی).
 */
export function averageCycleTime(issues: IssueForAnalytics[]): number | null {
  const done = issues.filter(
    (i) => i.status === "done" && i.closedAt !== null
  );
  if (done.length === 0) return null;

  const totalMs = done.reduce((sum, i) => {
    const start = i.startedAt ?? i.createdAt;
    return sum + (i.closedAt!.getTime() - start.getTime());
  }, 0);

  return totalMs / done.length; // میلی‌ثانیه
}

// ─── Lead Time (از درخواست تا تحویل) ───────────────────────────

/**
 * میانگین lead time: از createdAt ایشو تا closedAt (کل مسیر).
 * منبع: SELECT AVG(closed_at - created_at) FROM issues WHERE status='done' AND project_id=?
 * (بدون startedAt — تفاوت با cycle time: این شامل زمان انتظار در backlog هم هست)
 */
export function averageLeadTime(issues: IssueForAnalytics[]): number | null {
  const done = issues.filter(
    (i) => i.status === "done" && i.closedAt !== null
  );
  if (done.length === 0) return null;

  const totalMs = done.reduce(
    (sum, i) => sum + (i.closedAt!.getTime() - i.createdAt.getTime()),
    0
  );
  return totalMs / done.length;
}

// ─── PR Throughput ──────────────────────────────────────────────

/**
 * تعداد PRهای merge شده در بازه زمانی.
 * منبع: SELECT count(*) FROM github_pull_requests WHERE merged_at BETWEEN ? AND ? AND repo_id IN (...)
 */
export function prThroughput(
  prs: PullRequestForAnalytics[],
  from: Date,
  to: Date
): number {
  return prs.filter(
    (pr) =>
      pr.mergedAt !== null &&
      pr.mergedAt >= from &&
      pr.mergedAt <= to
  ).length;
}

// ─── Review Time ────────────────────────────────────────────────

/**
 * میانگین زمان اولین ریویو: از ساخت PR تا اولین review.
 * منبع: SELECT AVG(MIN(submitted_at) - pr.github_created_at) FROM github_reviews JOIN ... GROUP BY pr.id
 */
export function averageTimeToFirstReview(
  prs: PullRequestForAnalytics[],
  reviews: ReviewForAnalytics[]
): number | null {
  const reviewByPr = new Map<string, Date>();
  for (const r of reviews) {
    if (r.submittedAt === null) continue;
    const existing = reviewByPr.get(r.pullRequestId);
    if (!existing || r.submittedAt < existing) {
      reviewByPr.set(r.pullRequestId, r.submittedAt);
    }
  }

  const durations: number[] = [];
  for (const pr of prs) {
    const firstReview = reviewByPr.get(pr.id);
    if (firstReview && pr.githubCreatedAt && firstReview >= pr.githubCreatedAt) {
      durations.push(firstReview.getTime() - pr.githubCreatedAt.getTime());
    }
  }

  if (durations.length === 0) return null;
  return durations.reduce((a, b) => a + b, 0) / durations.length;
}

// ─── Work Distribution ──────────────────────────────────────────

/**
 * توزیع کار بین اعضا — بر اساس استوری‌پوینت (نه تعداد ایشو).
 * منبع: SELECT assignee_id, SUM(estimate) FROM issues WHERE project_id=? AND status NOT IN ('cancelled') GROUP BY assignee_id
 * ⚠️ unassigned با کلید null برمی‌گردد.
 * ❌ هیچ‌وقت برای سنجش فرد به‌عنوان متریک ونتی استفاده نشود — فقط برای دیدن توزیع بار.
 */
export function workDistribution(
  issues: Array<Pick<IssueForAnalytics, "assigneeId" | "estimate" | "status">>
): Array<{ assigneeId: string | null; totalEstimate: number; issueCount: number }> {
  const map = new Map<string | null, { totalEstimate: number; issueCount: number }>();

  for (const i of issues) {
    if (i.status === "cancelled") continue;
    const key = i.assigneeId;
    const entry = map.get(key) ?? { totalEstimate: 0, issueCount: 0 };
    entry.totalEstimate += Math.max(i.estimate, 0);
    entry.issueCount += 1;
    map.set(key, entry);
  }

  return Array.from(map.entries())
    .map(([assigneeId, v]) => ({ assigneeId, ...v }))
    .sort((a, b) => b.totalEstimate - a.totalEstimate);
}

// ─── Burndown ───────────────────────────────────────────────────

export interface BurndownPoint {
  /** تاریخ نقطه (ISO string) */
  date: string;
  /** وزن باقی‌مانده در آن تاریخ */
  remaining: number;
  /** خط ایده‌آل — مقدار مورد انتظار اگر ثابت کار کنیم */
  ideal: number;
}

/**
 * burndown سایکل: سری زمانی وزن باقی‌مانده برای Recharts.
 * منبع: SELECT estimate, closed_at FROM issues WHERE cycle_id=? AND status='done'
 *        UNION SELECT estimate, NULL FROM issues WHERE cycle_id=? AND status NOT IN ('done','cancelled')
 *
 * الگوریتم:
 *  - شروع: مجموع کل وزن سایکل.
 *  - در هر روز: وزن ایشوهای closed آن روز کم می‌شود.
 *  - خط ایده‌آل: خطی از total به ۰ در بازه سایکل.
 */
export function cycleBurndown(
  issues: Array<Pick<IssueForAnalytics, "estimate" | "closedAt" | "status">>,
  cycleStart: Date,
  cycleEnd: Date
): BurndownPoint[] {
  const totalWeight = issues
    .filter((i) => i.status !== "cancelled")
    .reduce((sum, i) => sum + Math.max(i.estimate, 0), 0);

  if (totalWeight === 0) return [];

  // وزن بسته‌شده در هر روز (فقط ایشوهای done)
  const closedByDay = new Map<string, number>();
  for (const i of issues) {
    if (i.status !== "done" || !i.closedAt) continue;
    if (i.closedAt < cycleStart || i.closedAt > cycleEnd) continue;
    const dayKey = i.closedAt.toISOString().slice(0, 10);
    closedByDay.set(dayKey, (closedByDay.get(dayKey) ?? 0) + Math.max(i.estimate, 0));
  }

  const totalDays = Math.max(
    1,
    Math.ceil((cycleEnd.getTime() - cycleStart.getTime()) / 86400000)
  );
  const now = new Date();
  const lastDay = Math.min(
    totalDays,
    Math.ceil(Math.max(0, now.getTime() - cycleStart.getTime()) / 86400000)
  );

  const points: BurndownPoint[] = [];
  let remaining = totalWeight;

  for (let day = 0; day <= lastDay; day++) {
    const date = new Date(cycleStart.getTime() + day * 86400000);
    const dayKey = date.toISOString().slice(0, 10);
    remaining -= closedByDay.get(dayKey) ?? 0;

    const ideal =
      totalWeight - (totalWeight * day) / totalDays;

    points.push({
      date: dayKey,
      remaining: Math.max(0, remaining),
      ideal: Math.max(0, ideal),
    });
  }

  return points;
}

// ─── Stale PRs (متروک) ─────────────────────────────────────────

/**
 * PRهای باز بیش از staleDays روز (پیش‌فرض ۱۴) بدون merge.
 * منبع: SELECT * FROM github_pull_requests WHERE state IN ('open','draft') AND github_created_at < now() - interval '14 days'
 * برای محاسبه Health (بخش ۷ سند) استفاده می‌شود.
 */
export function findStalePrs(
  prs: PullRequestForAnalytics[],
  now: Date,
  staleDays = 14
): PullRequestForAnalytics[] {
  const cutoff = now.getTime() - staleDays * 86400000;
  return prs.filter(
    (pr) =>
      (pr.state === "open" || pr.state === "draft") &&
      pr.githubCreatedAt !== null &&
      pr.githubCreatedAt.getTime() < cutoff
  );
}

// ─── Blocked / Overdue ──────────────────────────────────────────

/**
 * ایشوهای بلاک و عقب‌افتاده برای Health.
 * منبع:
 *   blocked: SELECT count(*) FROM issues WHERE project_id=? AND status='blocked'
 *   overdue: SELECT count(*) FROM issues WHERE project_id=? AND due_date < CURRENT_DATE AND status NOT IN ('done','cancelled')
 */
export interface IssueWithDueDate {
  status: IssueStatus;
  dueDate: Date | null;
}

export function countBlockedAndOverdue(
  issues: Array<Pick<IssueWithDueDate, "status" | "dueDate">>,
  now: Date
): { blockedCount: number; overdueCount: number } {
  let blockedCount = 0;
  let overdueCount = 0;

  for (const i of issues) {
    if (i.status === "blocked") blockedCount++;
    if (
      i.dueDate !== null &&
      i.dueDate < now &&
      i.status !== "done" &&
      i.status !== "cancelled"
    ) {
      overdueCount++;
    }
  }

  return { blockedCount, overdueCount };
}
