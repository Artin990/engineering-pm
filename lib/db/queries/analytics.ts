/**
 * کوئری‌های آنالیتیکس/پیشرفت — OpenClaw (موج ۲).
 *
 * ⚠️ اسکیما دست نخورده — فقط کوئری اضافه شده (طبق قانون پرامپت).
 * هر تابع ورودیِ توابع pure در lib/progress و lib/analytics را از داده واقعی می‌سازد.
 * هیچ عددی از این لایه ساخته یا حدس زده نمی‌شود — فقط ردیابی.
 */

import { and, eq, isNull, sql, notInArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  issues,
  cycles,
  milestones,
  projects,
  githubPullRequests,
  githubReviews,
  githubRepositories,
} from "@/lib/db/schema";
import type { IssueForProgress, ProgressResult } from "@/lib/progress";
import {
  computeCompletion,
  computeEstimatedDelivery,
  computeHealth,
  rollupProgress,
} from "@/lib/progress";
import type {
  IssueForAnalytics,
  PullRequestForAnalytics,
  ReviewForAnalytics,
} from "@/lib/analytics";
import { countBlockedAndOverdue, cycleBurndown, findStalePrs } from "@/lib/analytics";

// فقط ایشوهای زنده (soft delete نشده) و غیر cancelled از مخرج حذف می‌شوند
// — cancelled داخل computeCompletion حذف می‌شود، اینجا فقط deleted فیلتر می‌شود.
const LIVE_ISSUE = isNull(issues.deletedAt);

// ─── Progress: پروژه / سایکل / مایلستون ─────────────────────────

/**
 * منبع: SELECT id, status, estimate FROM issues WHERE project_id=? AND deleted_at IS NULL
 */
export async function getProjectIssuesForProgress(
  projectId: string
): Promise<IssueForProgress[]> {
  const rows = await db
    .select({
      id: issues.id,
      status: issues.status,
      estimate: issues.estimate,
    })
    .from(issues)
    .where(and(eq(issues.projectId, projectId), LIVE_ISSUE));

  return rows;
}

/** پیشرفت وزنی یک پروژه — ورودی مستقیم computeCompletion */
export async function getProjectProgress(projectId: string): Promise<ProgressResult> {
  const rows = await getProjectIssuesForProgress(projectId);
  return computeCompletion(rows);
}

/**
 * پیشرفت سایکل‌های پروژه برای رول‌آپ.
 * منبع: SELECT c.id, SUM(i.estimate), i.status FROM cycles c LEFT JOIN issues i ON i.cycle_id=c.id WHERE c.project_id=? GROUP BY c.id
 */
export async function getProjectCyclesSubProgress(projectId: string) {
  const cycleRows = await db
    .select({
      id: cycles.id,
      name: cycles.name,
      startDate: cycles.startDate,
      endDate: cycles.endDate,
      status: cycles.status,
    })
    .from(cycles)
    .where(and(eq(cycles.projectId, projectId), isNull(cycles.deletedAt)));

  const subs = [];
  for (const c of cycleRows) {
    const rows = await db
      .select({ id: issues.id, status: issues.status, estimate: issues.estimate })
      .from(issues)
      .where(and(eq(issues.cycleId, c.id), LIVE_ISSUE));

    const progress = computeCompletion(rows);
    subs.push({
      id: c.id,
      name: c.name,
      startDate: c.startDate,
      endDate: c.endDate,
      status: c.status,
      progress,
      // وزن رول‌آپ = مجموع estimateها (نه تعداد خام) — مطابق سند بخش ۷
      weight: progress.totalWeight,
      completion: progress.completion,
    });
  }
  return subs;
}

/** پیشرفت مایلستون‌های پروژه برای رول‌آپ — مشابه سایکل‌ها */
export async function getProjectMilestonesSubProgress(projectId: string) {
  const msRows = await db
    .select({ id: milestones.id, title: milestones.title })
    .from(milestones)
    .where(and(eq(milestones.projectId, projectId), isNull(milestones.deletedAt)));

  const subs = [];
  for (const m of msRows) {
    const rows = await db
      .select({ id: issues.id, status: issues.status, estimate: issues.estimate })
      .from(issues)
      .where(and(eq(issues.milestoneId, m.id), LIVE_ISSUE));

    const progress = computeCompletion(rows);
    subs.push({
      id: m.id,
      title: m.title,
      progress,
      weight: progress.totalWeight,
      completion: progress.completion,
    });
  }
  return subs;
}

/**
 * پیشرفت رول‌آپ پروژه = رول‌آپ وزنی از (سایکل جاری/فعال + مایلستون‌ها).
 * مطابق سند بخش ۷: «رول‌آپ وزنی از سایکل جاری + مایلستون‌ها (نه میانگین ساده)»
 * اگر هر دو خالی باشند، به computeCompletion مستقیم روی همه ایشوها fallback می‌شود.
 */
export async function getProjectRollupProgress(projectId: string): Promise<ProgressResult> {
  const [cycleSubs, msSubs] = await Promise.all([
    getProjectCyclesSubProgress(projectId),
    getProjectMilestonesSubProgress(projectId),
  ]);

  const subs = [...cycleSubs, ...msSubs];

  if (subs.length === 0) {
    return getProjectProgress(projectId);
  }

  const completion = rollupProgress(subs);

  // totalWeight/doneCount از محاسبه مستقیم برای سازگاری ProgressResult
  const direct = await getProjectProgress(projectId);
  return { ...direct, completion };
}

// ─── Health ─────────────────────────────────────────────────────

/**
 * ورودی‌های Health پروژه:
 *  - blocked/overdue از issues (lib/analytics.countBlockedAndOverdue)
 *  - stale PR از github_pull_requests (lib/analytics.findStalePrs)
 *  - paceOnTrack از computeEstimatedDelivery (شیب burndown ÷ شیب لازم تا target_date)
 */
export async function getProjectHealth(projectId: string) {
  const [project] = await db
    .select({
      id: projects.id,
      targetDate: projects.targetDate,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1);

  if (!project) {
    throw new Error(`پروژه ${projectId} یافت نشد`);
  }

  const rows = await db
    .select({
      id: issues.id,
      status: issues.status,
      estimate: issues.estimate,
      dueDate: issues.dueDate,
      createdAt: issues.createdAt,
      closedAt: issues.closedAt,
    })
    .from(issues)
    .where(and(eq(issues.projectId, projectId), LIVE_ISSUE));

  const progress = computeCompletion(rows);

  // ایشوهای مرتبط با repo های این پروژه برای stale PR
  const prs = await getProjectPullRequests(projectId);
  const now = new Date();
  const { blockedCount, overdueCount } = countBlockedAndOverdue(
    rows.map((r) => ({ status: r.status, dueDate: r.dueDate ? new Date(r.dueDate) : null })),
    now
  );
  const stalePrCount = findStalePrs(prs, now).length;

  // pace: از شروع پروژه تا target_date
  const targetDate = project.targetDate ? new Date(project.targetDate) : null;
  let paceOnTrack = true;
  let deliveryRatio: number | null = null;

  if (targetDate && progress.totalWeight > 0) {
    const elapsedDays = Math.max(
      0,
      (now.getTime() - project.createdAt.getTime()) / 86400000
    );
    const totalDays = Math.max(
      0.001,
      (targetDate.getTime() - project.createdAt.getTime()) / 86400000
    );
    deliveryRatio = computeEstimatedDelivery(
      progress.completedWeight,
      progress.totalWeight,
      elapsedDays,
      totalDays
    );
    // ratio >= 1 یعنی سر وقت؛ کمی تلورانس 0.9 برای شروع کند سایکل‌های اول
    paceOnTrack = deliveryRatio === null ? true : deliveryRatio >= 0.9;
  }

  const health = computeHealth({
    progress,
    blockedCount,
    overdueCount,
    stalePrCount,
    paceOnTrack,
  });

  return {
    progress,
    health,
    deliveryRatio,
  };
}

// ─── GitHub برای آنالیتیکس ──────────────────────────────────────

/**
 * PRهای مرتبط با پروژه (از طریق repo های متصل).
 * منبع: SELECT pr.* FROM github_pull_requests pr JOIN github_repositories r ON r.id=pr.repo_id WHERE r.project_id=?
 */
export async function getProjectPullRequests(
  projectId: string
): Promise<PullRequestForAnalytics[]> {
  const rows = await db
    .select({
      id: githubPullRequests.id,
      state: githubPullRequests.state,
      authorId: githubPullRequests.authorId,
      githubCreatedAt: githubPullRequests.githubCreatedAt,
      mergedAt: githubPullRequests.mergedAt,
      closedAt: githubPullRequests.closedAt,
    })
    .from(githubPullRequests)
    .innerJoin(
      githubRepositories,
      eq(githubRepositories.id, githubPullRequests.repoId)
    )
    .where(eq(githubRepositories.projectId, projectId));

  return rows;
}

/**
 * ریویوهای PRهای پروژه.
 * منبع: SELECT gr.* FROM github_reviews gr JOIN github_pull_requests pr ON pr.id=gr.pull_request_id JOIN github_repositories r ON r.id=pr.repo_id WHERE r.project_id=?
 */
export async function getProjectReviews(
  projectId: string
): Promise<ReviewForAnalytics[]> {
  const rows = await db
    .select({
      pullRequestId: githubReviews.pullRequestId,
      reviewerId: githubReviews.reviewerId,
      state: githubReviews.state,
      submittedAt: githubReviews.submittedAt,
    })
    .from(githubReviews)
    .innerJoin(
      githubPullRequests,
      eq(githubPullRequests.id, githubReviews.pullRequestId)
    )
    .innerJoin(
      githubRepositories,
      eq(githubRepositories.id, githubPullRequests.repoId)
    )
    .where(eq(githubRepositories.projectId, projectId));

  return rows;
}

// ─── Analytics Summary ──────────────────────────────────────────

/**
 * خلاصه آنالیتیکس پروژه — هر عدد ردیابی‌پذیر به کوئری بالایی.
 * ورودیِ توابع pure در lib/analytics.
 */
export async function getProjectAnalyticsSummary(projectId: string) {
  const issueRows = await db
    .select({
      id: issues.id,
      status: issues.status,
      estimate: issues.estimate,
      assigneeId: issues.assigneeId,
      cycleId: issues.cycleId,
      createdAt: issues.createdAt,
      closedAt: issues.closedAt,
      dueDate: issues.dueDate,
    })
    .from(issues)
    .where(and(eq(issues.projectId, projectId), LIVE_ISSUE));

  const issuesForAnalytics: IssueForAnalytics[] = issueRows.map((r) => ({
    id: r.id,
    status: r.status,
    estimate: r.estimate,
    assigneeId: r.assigneeId,
    cycleId: r.cycleId,
    createdAt: r.createdAt,
    closedAt: r.closedAt,
  }));

  const [prs, reviews] = await Promise.all([
    getProjectPullRequests(projectId),
    getProjectReviews(projectId),
  ]);

  return { issues: issuesForAnalytics, prs, reviews };
}

/**
 * burndown سایکل — داده سری زمانی برای Recharts.
 * منبع: SELECT estimate, closed_at, status FROM issues WHERE cycle_id=? AND deleted_at IS NULL
 */
export async function getCycleBurndown(cycleId: string) {
  const [cycle] = await db
    .select({
      id: cycles.id,
      startDate: cycles.startDate,
      endDate: cycles.endDate,
    })
    .from(cycles)
    .where(and(eq(cycles.id, cycleId), isNull(cycles.deletedAt)))
    .limit(1);

  if (!cycle) {
    throw new Error(`سایکل ${cycleId} یافت نشد`);
  }

  const rows = await db
    .select({
      id: issues.id,
      status: issues.status,
      estimate: issues.estimate,
      closedAt: issues.closedAt,
    })
    .from(issues)
    .where(and(eq(issues.cycleId, cycleId), LIVE_ISSUE));

  return cycleBurndown(
    rows,
    new Date(cycle.startDate),
    new Date(cycle.endDate)
  );
}

/**
 * ولاسیتی سایکل‌های یک پروژه (استوری‌پوینت done در هر سایکل).
 * منبع: SELECT cycle_id, SUM(estimate) FROM issues WHERE project_id=? AND status='done' AND deleted_at IS NULL GROUP BY cycle_id
 */
export async function getProjectCycleVelocities(projectId: string) {
  const rows = await db
    .select({
      cycleId: issues.cycleId,
      totalEstimate: sql<number>`coalesce(sum(${issues.estimate}), 0)`,
    })
    .from(issues)
    .where(
      and(
        eq(issues.projectId, projectId),
        LIVE_ISSUE,
        eq(issues.status, "done"),
        notInArray(issues.status, ["cancelled"])
      )
    )
    .groupBy(issues.cycleId);

  const cycleRows = await db
    .select({ id: cycles.id, name: cycles.name })
    .from(cycles)
    .where(and(eq(cycles.projectId, projectId), isNull(cycles.deletedAt)));

  const nameById = new Map(cycleRows.map((c) => [c.id, c.name]));
  return rows
    .filter((r) => r.cycleId !== null)
    .map((r) => ({
      cycleId: r.cycleId as string,
      cycleName: nameById.get(r.cycleId as string) ?? "",
      velocity: Number(r.totalEstimate),
    }));
}
