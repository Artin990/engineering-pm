/**
 * کوئری جزئیات ایشو — همه داده‌های لازم صفحه detail در یک فراخوانی
 * (بدون N+1: کامنت‌ها، لیبل‌ها، assigneeها، وابستگی‌ها، لینک‌های گیت‌هاب).
 */
import { eq, and, isNull, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  issues,
  issueComments,
  issueLabels,
  issueAssignees,
  issueDependencies,
  labels,
  profiles,
  milestones,
  cycles,
  modules,
  githubIssueLinks,
  githubPullRequests,
} from "@/lib/db/schema";

export async function getIssueDetail(issueId: string) {
  const [issue] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
    .limit(1);

  if (!issue) return null;

  // همه کوئری‌های فرعی موازی — بدون N+1
  const [commentRows, labelRows, assigneeRows, depRows, linkRows, parentIssue] =
    await Promise.all([
      // کامنت‌ها + نویسنده
      db
        .select({
          id: issueComments.id,
          body: issueComments.body,
          authorId: issueComments.authorId,
          authorName: profiles.displayName,
          authorAvatar: profiles.avatarUrl,
          createdAt: issueComments.createdAt,
          updatedAt: issueComments.updatedAt,
        })
        .from(issueComments)
        .leftJoin(profiles, eq(profiles.id, issueComments.authorId))
        .where(and(eq(issueComments.issueId, issueId), isNull(issueComments.deletedAt)))
        .orderBy(issueComments.createdAt),

      // لیبل‌ها
      db
        .select({ id: labels.id, name: labels.name, color: labels.color })
        .from(issueLabels)
        .innerJoin(labels, eq(labels.id, issueLabels.labelId))
        .where(eq(issueLabels.issueId, issueId)),

      // assigneeها + پروفایل
      db
        .select({
          userId: issueAssignees.userId,
          name: profiles.displayName,
          avatar: profiles.avatarUrl,
        })
        .from(issueAssignees)
        .leftJoin(profiles, eq(profiles.id, issueAssignees.userId))
        .where(eq(issueAssignees.issueId, issueId)),

      // وابستگی‌ها + کلید/عنوان ایشوی وابسته
      db
        .select({
          dependsOnId: issueDependencies.dependsOnId,
          key: issues.key,
          title: issues.title,
          status: issues.status,
        })
        .from(issueDependencies)
        .innerJoin(issues, eq(issues.id, issueDependencies.dependsOnId))
        .where(eq(issueDependencies.issueId, issueId)),

      // لینک‌های گیت‌هاب (PRها)
      db
        .select({
          linkId: githubIssueLinks.id,
          prId: githubPullRequests.id,
          prNumber: githubPullRequests.prNumber,
          prTitle: githubPullRequests.title,
          prState: githubPullRequests.state,
          prUrl: githubPullRequests.url,
          suggestedStatus: githubIssueLinks.suggestedStatus,
          suggestionState: githubIssueLinks.suggestionState,
        })
        .from(githubIssueLinks)
        .leftJoin(githubPullRequests, eq(githubPullRequests.id, githubIssueLinks.pullRequestId))
        .where(eq(githubIssueLinks.issueId, issueId)),

      // ایشوی والد (برای breadcrumb)
      issue.parentId
        ? db
            .select({ id: issues.id, key: issues.key, title: issues.title })
            .from(issues)
            .where(eq(issues.id, issue.parentId))
            .limit(1)
        : Promise.resolve([]),
    ]);

  // مایلستون/سایکل/ماژول فقط اگر ست شده باشند
  const [milestone] = issue.milestoneId
    ? await db.select().from(milestones).where(eq(milestones.id, issue.milestoneId)).limit(1)
    : [];
  const [cycle] = issue.cycleId
    ? await db.select().from(cycles).where(eq(cycles.id, issue.cycleId)).limit(1)
    : [];
  const [module] = issue.moduleId
    ? await db.select().from(modules).where(eq(modules.id, issue.moduleId)).limit(1)
    : [];

  return {
    issue,
    parent: parentIssue[0] ?? null,
    milestone: milestone ?? null,
    cycle: cycle ?? null,
    module: module ?? null,
    comments: commentRows,
    labels: labelRows,
    assignees: assigneeRows,
    dependencies: depRows,
    githubLinks: linkRows,
  };
}

/** لیست ایشوها با assignee و لیبل برای جدول/بورد (دو کوئری جمع، بدون N+1). */
export async function listProjectIssuesWithMeta(projectId: string) {
  const rows = await db
    .select({
      issue: issues,
      assigneeName: profiles.displayName,
      assigneeAvatar: profiles.avatarUrl,
    })
    .from(issues)
    .leftJoin(profiles, eq(profiles.id, issues.assigneeId))
    .where(and(eq(issues.projectId, projectId), isNull(issues.deletedAt)))
    .orderBy(issues.order, issues.createdAt);

  const issueIds = rows.map((r) => r.issue.id);

  const labelRows = issueIds.length
    ? await db
        .select({ issueId: issueLabels.issueId, id: labels.id, name: labels.name, color: labels.color })
        .from(issueLabels)
        .innerJoin(labels, eq(labels.id, issueLabels.labelId))
        .where(inArray(issueLabels.issueId, issueIds))
    : [];

  const labelsByIssue = new Map<string, { id: string; name: string; color: string }[]>();
  for (const lr of labelRows) {
    const list = labelsByIssue.get(lr.issueId) ?? [];
    list.push({ id: lr.id, name: lr.name, color: lr.color });
    labelsByIssue.set(lr.issueId, list);
  }

  return rows.map((r) => ({
    ...r.issue,
    assigneeName: r.assigneeName,
    assigneeAvatar: r.assigneeAvatar,
    labels: labelsByIssue.get(r.issue.id) ?? [],
  }));
}
