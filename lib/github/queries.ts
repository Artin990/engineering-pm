/**
 * GitHub DB queries â€” matched EXACTLY to the actual drizzle schema.
 *
 * Schema columns (from lib/db/schema.ts):
 *
 * githubInstallations: id, workspaceIdâ†’workspaces, installationId (bigint number),
 *   accountLogin, accountType, accessToken, installedAt, createdAt, updatedAt
 *
 * githubRepositories: id, installationIdâ†’githubInstallations, repoId (bigint number),
 *   name ("owner/repo"), isPrivate, defaultBranch, projectIdâ†’projects (set null),
 *   createdAt, updatedAt
 *
 * githubBranches: id, repoIdâ†’githubRepositories, name, sha, authorIdâ†’profiles,
 *   issueIdâ†’issues (set null), createdAt, updatedAt
 *
 * githubCommits: id, repoIdâ†’githubRepositories, sha, message, authorLogin,
 *   authorIdâ†’profiles, branch, committedAt, createdAt
 *
 * githubPullRequests: id, repoIdâ†’githubRepositories, prNumber, title (varchar500),
 *   body, state (prStateEnum: open/closed/merged/draft), authorLogin, authorIdâ†’profiles,
 *   headBranch, baseBranch, url, mergedAt, closedAt, githubCreatedAt, createdAt, updatedAt
 *
 * githubReviews: id, pullRequestIdâ†’githubPullRequests, reviewId (bigint number),
 *   reviewerLogin, reviewerIdâ†’profiles, state, submittedAt, createdAt
 *
 * githubIssueLinks: id, issueIdâ†’issues, pullRequestIdâ†’githubPullRequests (nullable),
 *   branchIdâ†’githubBranches (nullable), suggestedStatus (issueStatusEnum, nullable),
 *   suggestionState (varchar20, default "pending"), createdAt, updatedAt
 *
 * githubEvents: id, deliveryId (uuid, uniqueIndex), event, action,
 *   installationId (bigint number), repoFullName, payload (jsonb),
 *   processedAt, status (varchar20, default "received"), createdAt
 *
 * issues: id, projectIdâ†’projects, key, title, description, status (issueStatusEnum),
 *   priority, type, estimate, dueDate, parentId, milestoneId, moduleId, cycleId,
 *   assigneeId, createdBy, order, createdAt, updatedAt, closedAt, deletedAt
 *
 * activities: id, workspaceIdâ†’workspaces, projectIdâ†’projects, actorIdâ†’profiles,
 *   kind, verb, entityType, entityId, metadata, createdAt
 *
 * notifications: id, userIdâ†’profiles, type, title, body, link, dedupeKey, readAt, createdAt
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  activities,
  githubBranches,
  githubCommits,
  githubEvents,
  githubInstallations,
  githubIssueLinks,
  githubPullRequests,
  githubRepositories,
  githubReviews,
  issues,
  notifications,
  projects,
} from "@/lib/db/schema";

/* ================================================================
   Installation
   ================================================================ */

/** Lookup by GitHub installation_id (number) â€” used by webhook handler. */
export async function getInstallationByGithubId(installationId: number) {
  const rows = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.installationId, installationId))
    .limit(1);
  return rows[0] ?? null;
}

/** List all installations for a workspace. */
export async function getInstallationsByWorkspace(workspaceId: string) {
  return db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.workspaceId, workspaceId));
}

/** Upsert installation row (by unique (workspaceId, installationId)). */
export async function upsertInstallation(input: {
  workspaceId: string;
  installationId: number;
  accountLogin: string;
  accountType: string;
  accessToken?: string | null;
}) {
  const existing = await db
    .select()
    .from(githubInstallations)
    .where(
      and(
        eq(githubInstallations.workspaceId, input.workspaceId),
        eq(githubInstallations.installationId, input.installationId)
      )
    )
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(githubInstallations)
      .set({
        accountLogin: input.accountLogin,
        accountType: input.accountType,
        ...(input.accessToken !== undefined && { accessToken: input.accessToken }),
        updatedAt: new Date(),
      })
      .where(eq(githubInstallations.id, existing[0].id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(githubInstallations)
    .values({
      workspaceId: input.workspaceId,
      installationId: input.installationId,
      accountLogin: input.accountLogin,
      accountType: input.accountType,
      accessToken: input.accessToken ?? null,
    })
    .returning();
  return created;
}

/** Delete installation (cascades to repos â†’ branches/commits/PRs/reviews). */
export async function deleteInstallationByGithubId(
  workspaceId: string,
  installationId: number
) {
  await db
    .delete(githubInstallations)
    .where(
      and(
        eq(githubInstallations.workspaceId, workspaceId),
        eq(githubInstallations.installationId, installationId)
      )
    );
}

/* ================================================================
   Repository
   ================================================================ */

/**
 * List all repos for a workspace (via join through installations).
 * Returns repo + installation info.
 */
export async function listReposByWorkspace(workspaceId: string) {
  return db
    .select({
      id: githubRepositories.id,
      repoId: githubRepositories.repoId,
      name: githubRepositories.name,
      isPrivate: githubRepositories.isPrivate,
      defaultBranch: githubRepositories.defaultBranch,
      projectId: githubRepositories.projectId,
      installationId: githubRepositories.installationId,
      githubInstallationId: githubInstallations.installationId,
      createdAt: githubRepositories.createdAt,
      updatedAt: githubRepositories.updatedAt,
    })
    .from(githubRepositories)
    .innerJoin(
      githubInstallations,
      eq(githubRepositories.installationId, githubInstallations.id)
    )
    .where(eq(githubInstallations.workspaceId, workspaceId));
}

/** List repos belonging to a specific installation (by DB UUID). */
export async function listReposByInstallation(installationDbId: string) {
  return db
    .select()
    .from(githubRepositories)
    .where(eq(githubRepositories.installationId, installationDbId));
}

/** Get repo by GitHub numeric repo_id. */
export async function getRepoByGithubRepoId(githubRepoId: number) {
  const rows = await db
    .select()
    .from(githubRepositories)
    .where(eq(githubRepositories.repoId, githubRepoId))
    .limit(1);
  return rows[0] ?? null;
}

/** Get repo by DB UUID. */
export async function getRepoById(repoDbId: string) {
  const rows = await db
    .select()
    .from(githubRepositories)
    .where(eq(githubRepositories.id, repoDbId))
    .limit(1);
  return rows[0] ?? null;
}

/** Upsert repo by unique repoId (GitHub numeric id). */
export async function upsertRepo(input: {
  installationDbId: string;
  repoId: number;
  name: string; // "owner/repo"
  isPrivate: boolean;
  defaultBranch?: string;
}) {
  const existing = await getRepoByGithubRepoId(input.repoId);
  if (existing) {
    const [updated] = await db
      .update(githubRepositories)
      .set({
        name: input.name,
        isPrivate: input.isPrivate,
        defaultBranch: input.defaultBranch ?? existing.defaultBranch,
        installationId: input.installationDbId,
        updatedAt: new Date(),
      })
      .where(eq(githubRepositories.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(githubRepositories)
    .values({
      installationId: input.installationDbId,
      repoId: input.repoId,
      name: input.name,
      isPrivate: input.isPrivate,
      defaultBranch: input.defaultBranch ?? "main",
    })
    .returning();
  return created;
}

/** Link a repo to an internal project. */
export async function linkRepoToProject(repoDbId: string, projectId: string | null) {
  const [updated] = await db
    .update(githubRepositories)
    .set({ projectId, updatedAt: new Date() })
    .where(eq(githubRepositories.id, repoDbId))
    .returning();
  return updated ?? null;
}

/* ================================================================
   Branch
   ================================================================ */

export async function getBranch(repoDbId: string, name: string) {
  const rows = await db
    .select()
    .from(githubBranches)
    .where(and(eq(githubBranches.repoId, repoDbId), eq(githubBranches.name, name)))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertBranch(input: {
  repoDbId: string;
  name: string;
  sha: string;
  issueId?: string | null;
}) {
  const existing = await getBranch(input.repoDbId, input.name);
  if (existing) {
    const [updated] = await db
      .update(githubBranches)
      .set({
        sha: input.sha,
        ...(input.issueId !== undefined && { issueId: input.issueId }),
        updatedAt: new Date(),
      })
      .where(eq(githubBranches.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(githubBranches)
    .values({
      repoId: input.repoDbId,
      name: input.name,
      sha: input.sha,
      issueId: input.issueId ?? null,
    })
    .returning();
  return created;
}

export async function deleteBranch(repoDbId: string, name: string) {
  await db
    .delete(githubBranches)
    .where(and(eq(githubBranches.repoId, repoDbId), eq(githubBranches.name, name)));
}

/* ================================================================
   Commit
   ================================================================ */

export async function commitExists(repoDbId: string, sha: string): Promise<boolean> {
  const rows = await db
    .select({ id: githubCommits.id })
    .from(githubCommits)
    .where(and(eq(githubCommits.repoId, repoDbId), eq(githubCommits.sha, sha)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Insert commit; returns the created row or null if it already exists (idempotent).
 */
export async function insertCommitIgnore(input: {
  repoDbId: string;
  sha: string;
  message: string;
  authorLogin?: string | null;
  authorId?: string | null;
  branch?: string | null;
  committedAt: Date;
}) {
  if (await commitExists(input.repoDbId, input.sha)) return null;
  const [created] = await db
    .insert(githubCommits)
    .values({
      repoId: input.repoDbId,
      sha: input.sha,
      message: input.message,
      authorLogin: input.authorLogin ?? null,
      authorId: input.authorId ?? null,
      branch: input.branch ?? null,
      committedAt: input.committedAt,
    })
    .returning();
  return created;
}

export async function listCommitsByRepo(repoDbId: string, limit = 20) {
  return db
    .select()
    .from(githubCommits)
    .where(eq(githubCommits.repoId, repoDbId))
    .limit(limit);
}

/* ================================================================
   Pull Request
   ================================================================ */

export async function getPrByRepoAndNumber(repoDbId: string, prNumber: number) {
  const rows = await db
    .select()
    .from(githubPullRequests)
    .where(
      and(
        eq(githubPullRequests.repoId, repoDbId),
        eq(githubPullRequests.prNumber, prNumber)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getPrById(prDbId: string) {
  const rows = await db
    .select()
    .from(githubPullRequests)
    .where(eq(githubPullRequests.id, prDbId))
    .limit(1);
  return rows[0] ?? null;
}

/** Upsert PR by unique (repoId, prNumber). */
export async function upsertPr(input: {
  repoDbId: string;
  prNumber: number;
  title: string;
  body?: string | null;
  state: "open" | "closed" | "merged" | "draft";
  authorLogin: string;
  authorId?: string | null;
  headBranch: string;
  baseBranch: string;
  url?: string | null;
  mergedAt?: Date | null;
  closedAt?: Date | null;
  githubCreatedAt?: Date | null;
}) {
  const existing = await getPrByRepoAndNumber(input.repoDbId, input.prNumber);
  if (existing) {
    const [updated] = await db
      .update(githubPullRequests)
      .set({
        title: input.title,
        body: input.body ?? existing.body,
        state: input.state,
        authorLogin: input.authorLogin,
        authorId: input.authorId ?? existing.authorId,
        headBranch: input.headBranch,
        baseBranch: input.baseBranch,
        url: input.url ?? existing.url,
        mergedAt: input.mergedAt ?? existing.mergedAt,
        closedAt: input.closedAt ?? existing.closedAt,
        githubCreatedAt: input.githubCreatedAt ?? existing.githubCreatedAt,
        updatedAt: new Date(),
      })
      .where(eq(githubPullRequests.id, existing.id))
      .returning();
    return { pr: updated, isNew: false };
  }
  const [created] = await db
    .insert(githubPullRequests)
    .values({
      repoId: input.repoDbId,
      prNumber: input.prNumber,
      title: input.title,
      body: input.body ?? null,
      state: input.state,
      authorLogin: input.authorLogin,
      authorId: input.authorId ?? null,
      headBranch: input.headBranch,
      baseBranch: input.baseBranch,
      url: input.url ?? null,
      mergedAt: input.mergedAt ?? null,
      closedAt: input.closedAt ?? null,
      githubCreatedAt: input.githubCreatedAt ?? null,
    })
    .returning();
  return { pr: created, isNew: true };
}

export async function listPrsByRepo(
  repoDbId: string,
  state?: "open" | "closed" | "merged" | "draft",
  limit = 20
) {
  const where = state
    ? and(eq(githubPullRequests.repoId, repoDbId), eq(githubPullRequests.state, state))
    : eq(githubPullRequests.repoId, repoDbId);
  return db.select().from(githubPullRequests).where(where).limit(limit);
}

/* ================================================================
   Review
   ================================================================ */

export async function reviewExists(reviewId: number): Promise<boolean> {
  const rows = await db
    .select({ id: githubReviews.id })
    .from(githubReviews)
    .where(eq(githubReviews.reviewId, reviewId))
    .limit(1);
  return rows.length > 0;
}

export async function insertReviewIgnore(input: {
  pullRequestDbId: string;
  reviewId: number;
  state: string;
  reviewerLogin: string;
  submittedAt: Date;
}) {
  if (await reviewExists(input.reviewId)) return null;
  const [created] = await db
    .insert(githubReviews)
    .values({
      pullRequestId: input.pullRequestDbId,
      reviewId: input.reviewId,
      state: input.state,
      reviewerLogin: input.reviewerLogin,
      submittedAt: input.submittedAt,
    })
    .returning();
  return created;
}

/* ================================================================
   Issue Links (auto-link issue â†” PR/branch)
   ================================================================ */

export async function insertLinkIfNew(input: {
  issueId: string;
  pullRequestId?: string | null;
  branchId?: string | null;
  suggestedStatus?: "backlog" | "todo" | "in_progress" | "in_review" | "blocked" | "done" | "cancelled" | null;
}) {
  // Prevent duplicate: same issue + same pullRequest OR same branch
  if (input.pullRequestId) {
    const existing = await db
      .select({ id: githubIssueLinks.id })
      .from(githubIssueLinks)
      .where(
        and(
          eq(githubIssueLinks.issueId, input.issueId),
          eq(githubIssueLinks.pullRequestId, input.pullRequestId)
        )
      )
      .limit(1);
    if (existing[0]) return existing[0];
  }
  if (input.branchId) {
    const existing = await db
      .select({ id: githubIssueLinks.id })
      .from(githubIssueLinks)
      .where(
        and(
          eq(githubIssueLinks.issueId, input.issueId),
          eq(githubIssueLinks.branchId, input.branchId)
        )
      )
      .limit(1);
    if (existing[0]) return existing[0];
  }
  const [created] = await db
    .insert(githubIssueLinks)
    .values({
      issueId: input.issueId,
      pullRequestId: input.pullRequestId ?? null,
      branchId: input.branchId ?? null,
      suggestedStatus: input.suggestedStatus ?? null,
      suggestionState: "pending",
    })
    .returning();
  return created;
}

export async function getLinksByIssue(issueId: string) {
  return db
    .select()
    .from(githubIssueLinks)
    .where(eq(githubIssueLinks.issueId, issueId));
}

/** Get all pending suggestions for issues in a project. */
export async function getPendingSuggestionsForProject(projectId: string) {
  return db
    .select({
      linkId: githubIssueLinks.id,
      issueId: githubIssueLinks.issueId,
      issueKey: issues.key,
      issueTitle: issues.title,
      issueStatus: issues.status,
      suggestedStatus: githubIssueLinks.suggestedStatus,
      suggestionState: githubIssueLinks.suggestionState,
      pullRequestId: githubIssueLinks.pullRequestId,
      branchId: githubIssueLinks.branchId,
      updatedAt: githubIssueLinks.updatedAt,
    })
    .from(githubIssueLinks)
    .innerJoin(issues, eq(githubIssueLinks.issueId, issues.id))
    .where(
      and(
        eq(issues.projectId, projectId),
        eq(githubIssueLinks.suggestionState, "pending")
      )
    );
}

export async function updateSuggestionState(
  linkId: string,
  state: "pending" | "accepted" | "rejected"
) {
  const [updated] = await db
    .update(githubIssueLinks)
    .set({ suggestionState: state, updatedAt: new Date() })
    .where(eq(githubIssueLinks.id, linkId))
    .returning();
  return updated ?? null;
}

/* ================================================================
   Issue (read-only helper for key lookup)
   ================================================================ */

export async function getIssueByKey(projectId: string, key: string) {
  const rows = await db
    .select()
    .from(issues)
    .where(and(eq(issues.projectId, projectId), eq(issues.key, key)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getIssueById(issueId: string) {
  const rows = await db
    .select()
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);
  return rows[0] ?? null;
}

/** Update issue status (used when accepting a suggestion). */
export async function updateIssueStatus(issueId: string, status: string) {
  const [updated] = await db
    .update(issues)
    .set({ status: status as typeof issues.$inferInsert.status, updatedAt: new Date() })
    .where(eq(issues.id, issueId))
    .returning();
  return updated ?? null;
}

/* ================================================================
   Webhook Event (idempotency)
   ================================================================ */

export async function insertEventIfNew(input: {
  deliveryId: string;
  event: string;
  action?: string | null;
  installationId?: number | null;
  repoFullName?: string | null;
  payload: unknown;
}): Promise<"inserted" | "duplicate"> {
  try {
    await db.insert(githubEvents).values({
      deliveryId: input.deliveryId,
      event: input.event,
      action: input.action ?? null,
      installationId: input.installationId ?? null,
      repoFullName: input.repoFullName ?? null,
      payload: input.payload,
    });
    return "inserted";
  } catch (err) {
    // Unique constraint violation on delivery_id = duplicate â†’ skip
    const code = (err as { code?: string }).code;
    if (code === "23505" || String((err instanceof Error ? err.message : String(err)) ?? "").includes("unique")) {
      return "duplicate";
    }
    throw err;
  }
}

export async function markEventProcessed(deliveryId: string) {
  await db
    .update(githubEvents)
    .set({ status: "processed", processedAt: new Date() })
    .where(eq(githubEvents.deliveryId, deliveryId));
}

export async function markEventFailed(deliveryId: string) {
  await db
    .update(githubEvents)
    .set({ status: "failed", processedAt: new Date() })
    .where(eq(githubEvents.deliveryId, deliveryId));
}

export async function getPendingEvents(limit = 50) {
  return db
    .select()
    .from(githubEvents)
    .where(eq(githubEvents.status, "received"))
    .limit(limit);
}

export async function getFailedEvents(limit = 20) {
  return db
    .select()
    .from(githubEvents)
    .where(eq(githubEvents.status, "failed"))
    .limit(limit);
}

/* ================================================================
   Activities (GitHub activity log)
   ================================================================ */

export async function insertActivity(input: {
  workspaceId: string;
  projectId?: string | null;
  actorId?: string | null;
  kind: string;
  verb: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const [created] = await db
    .insert(activities)
    .values({
      workspaceId: input.workspaceId,
      projectId: input.projectId ?? null,
      actorId: input.actorId ?? null,
      kind: input.kind,
      verb: input.verb,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? null,
    })
    .returning();
  return created;
}

/* ================================================================
   Notifications
   ================================================================ */

export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  dedupeKey?: string | null;
}) {
  const [created] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      dedupeKey: input.dedupeKey ?? null,
    })
    .returning();
  return created;
}

export async function notificationExistsByDedupe(dedupeKey: string): Promise<boolean> {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(eq(notifications.dedupeKey, dedupeKey))
    .limit(1);
  return rows.length > 0;
}

/* ================================================================
   Workspace helpers (for resolving workspace from installation)
   ================================================================ */

/** Get workspaceId from a GitHub installation. */
export async function getWorkspaceIdForInstallation(
  installationId: number
): Promise<string | null> {
  const row = await getInstallationByGithubId(installationId);
  return row?.workspaceId ?? null;
}

/** Get all project IDs in a workspace (for auto-linking issue keys). */
export async function getProjectIdsForWorkspace(workspaceId: string) {
  const rows = await db
    .select({ id: projects.id, key: projects.key })
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId));
  return rows;
}
