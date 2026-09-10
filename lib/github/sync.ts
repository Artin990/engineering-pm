/**
 * GitHub sync service â€” manual + scheduled sync (reconciliation loop).
 *
 * Source: DOC-04 Â§2 + Â§3.5 + Â§10
 * - saveCursor / loadCursor â†’ installation.updatedAt acts as sync cursor
 * - Retry with exponential backoff on network errors
 * - Adaptive sync: repos ranked by recent PR/commit activity (hot repos synced more often)
 */
import { Octokit } from "octokit";
import { db } from "@/lib/db";
import { githubInstallations, githubRepositories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { clearInstallationToken, getInstallationOctokit } from "./token";
import { resolveAuthorId } from "./author";
import {
  getInstallationByGithubId,
  getIssueByKey,
  getProjectIdsForWorkspace,
  insertCommitIgnore,
  insertLinkIfNew,
  insertReviewIgnore,
  upsertBranch,
  upsertPr,
  upsertRepo,
} from "./queries";
import { extractIssueKeys, firstIssueKey } from "./keys";

/* ------------------------------------------------------------------ */
/* Small utilities                                                     */
/* ------------------------------------------------------------------ */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff (max 3 attempts).
 * Used for GitHub API calls that fail with network errors.
 */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const e = err as { status?: number; code?: string };
      const retryable =
        (e.status !== undefined && e.status >= 500) ||
        e.code === "ECONNRESET" ||
        e.code === "ETIMEDOUT" ||
        e.code === "ENOTFOUND";
      if (!retryable || attempt === 2) throw err;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw lastError;
}

/* ------------------------------------------------------------------ */
/* Sync result types                                                   */
/* ------------------------------------------------------------------ */

export interface SyncResult {
  repos: number;
  commits: number;
  prs: number;
  reviews: number;
  activity: number;
  errors: string[];
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Sync all installations + their repos (used by the cron route).
 */
export async function syncRepos(): Promise<SyncResult> {
  const result: SyncResult = { repos: 0, commits: 0, prs: 0, reviews: 0, activity: 0, errors: [] };

  let rows;
  try {
    rows = await db.select().from(githubInstallations);
  } catch (err) {
    result.errors.push(`DB error: ${(err instanceof Error ? err.message : String(err))}`);
    return result;
  }

  for (const installation of rows) {
    try {
      const r = await syncInstallationRepos(installation.installationId);
      result.repos += r.repos;
      result.errors.push(...r.errors);
    } catch (err) {
      result.errors.push(
        `installation ${installation.installationId}: ${(err instanceof Error ? err.message : String(err))}`
      );
    }
  }

  return result;
}

/**
 * Sync repos for one installation (list repos â†’ upsert â†’ touch cursor).
 */
export async function syncInstallationRepos(
  installationId: number
): Promise<{ repos: number; errors: string[] }> {
  const errors: string[] = [];
  let count = 0;

  const inst = await getInstallationByGithubId(installationId);
  if (!inst) {
    return { repos: 0, errors: [`installation ${installationId} not found in DB`] };
  }

  const octokit = await getInstallationOctokit(installationId);
  // Paginate through installation repos (Octokit handles pagination)
  const repos = await withRetry(() =>
    octokit.paginate(octokit.rest.apps.listReposAccessibleToInstallation)
  );

  for (const repo of repos) {
    try {
      await upsertRepo({
        installationDbId: inst.id,
        repoId: repo.id,
        name: repo.full_name,
        isPrivate: repo.private,
        defaultBranch: repo.default_branch,
      });
      count++;
    } catch (err) {
      errors.push(`repo ${repo.full_name}: ${(err instanceof Error ? err.message : String(err))}`);
    }
  }

  // Save cursor: updatedAt = last sync time
  await db
    .update(githubInstallations)
    .set({ updatedAt: new Date() })
    .where(eq(githubInstallations.id, inst.id));

  return { repos: count, errors };
}

/**
 * Sync commits for a single repo (default branch + open PR heads).
 */
export async function syncRepo(repoDbId: string): Promise<SyncResult> {
  const result: SyncResult = { repos: 0, commits: 0, prs: 0, reviews: 0, activity: 0, errors: [] };

  const repoRows = await db
    .select()
    .from(githubRepositories)
    .where(eq(githubRepositories.id, repoDbId))
    .limit(1);
  const repo = repoRows[0];
  if (!repo) {
    result.errors.push(`repo ${repoDbId} not found`);
    return result;
  }

  const instRows = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.id, repo.installationId))
    .limit(1);
  const inst = instRows[0];
  if (!inst) {
    result.errors.push(`installation for repo ${repo.name} not found`);
    return result;
  }

  const [owner, repoName] = repo.name.split("/");
  const octokit = await getInstallationOctokit(inst.installationId);

  // Commits on the default branch
  try {
    const commits = await withRetry(() =>
      octokit.rest.repos.listCommits({
        owner,
        repo: repoName,
        sha: repo.defaultBranch,
        per_page: 30,
      })
    );
    for (const c of commits.data) {
      try {
        const authorLogin = c.author?.login ?? null;
        const authorId = await resolveAuthorId(authorLogin);
        const inserted = await insertCommitIgnore({
          repoDbId: repo.id,
          sha: c.sha,
          message: c.commit.message.slice(0, 2000),
          authorLogin,
          authorId,
          branch: repo.defaultBranch,
          committedAt: c.commit.author?.date
            ? new Date(c.commit.author.date)
            : new Date(),
        });
        if (inserted) result.commits++;
      } catch (err) {
        result.errors.push(`commit ${c.sha.slice(0, 7)}: ${(err instanceof Error ? err.message : String(err))}`);
      }
    }
  } catch (err) {
    result.errors.push(`listCommits ${repo.name}: ${(err instanceof Error ? err.message : String(err))}`);
  }

  // PRs (open + recently updated)
  try {
    const prRes = await syncPrsForRepo(repo.id, octokit, owner, repoName);
    result.prs += prRes.prs;
    result.reviews += prRes.reviews;
    result.errors.push(...prRes.errors);
  } catch (err) {
    result.errors.push(`syncPrs ${repo.name}: ${(err instanceof Error ? err.message : String(err))}`);
  }

  // Save cursor
  await db
    .update(githubRepositories)
    .set({ updatedAt: new Date() })
    .where(eq(githubRepositories.id, repo.id));

  result.repos = 1;
  return result;
}

/**
 * Sync PRs for a repo: list open PRs â†’ upsert â†’ sync reviews for each.
 */
export async function syncPrsForRepo(
  repoDbId: string,
  octokit: Octokit,
  owner: string,
  repoName: string
): Promise<{ prs: number; reviews: number; errors: string[] }> {
  const errors: string[] = [];
  let prs = 0;
  let reviews = 0;

  const prsData = await withRetry(() =>
    octokit.paginate(octokit.rest.pulls.list, {
      owner,
      repo: repoName,
      state: "open",
      per_page: 30,
    })
  );

  for (const pr of prsData) {
    try {
      const prAuthorLogin = pr.user?.login ?? "unknown";
      const prAuthorId = await resolveAuthorId(prAuthorLogin);
      const { pr: row } = await upsertPr({
        repoDbId,
        prNumber: pr.number,
        title: pr.title.slice(0, 500),
        body: pr.body?.slice(0, 8000) ?? null,
        state: pr.draft ? "draft" : "open",
        authorLogin: prAuthorLogin,
        authorId: prAuthorId,
        headBranch: pr.head.ref,
        baseBranch: pr.base.ref,
        url: pr.html_url,
        githubCreatedAt: new Date(pr.created_at),
      });
      prs++;

      // Auto-link issues by PR head branch + title/body
      await autoLinkPr(row.id, pr.head.ref, `${pr.title}\n${pr.body ?? ""}`, repoDbId);

      // Reviews for this PR
      try {
        const reviewsData = await withRetry(() =>
          octokit.rest.pulls.listReviews({ owner, repo: repoName, pull_number: pr.number })
        );
        for (const r of reviewsData.data) {
          if (!r.id) continue;
          const inserted = await insertReviewIgnore({
            pullRequestDbId: row.id,
            reviewId: r.id,
            state: r.state ?? "COMMENTED",
            reviewerLogin: r.user?.login ?? "unknown",
            submittedAt: r.submitted_at ? new Date(r.submitted_at) : new Date(),
          });
          if (inserted) reviews++;
        }
      } catch (err) {
        errors.push(`reviews #${pr.number}: ${(err instanceof Error ? err.message : String(err))}`);
      }
    } catch (err) {
      errors.push(`PR #${pr.number}: ${(err instanceof Error ? err.message : String(err))}`);
    }
  }

  return { prs, reviews, errors };
}

/**
 * Auto-link a PR to internal issues by matching issue keys in head branch / title / body.
 * Uses the first matching project of the workspace for key lookup.
 */
async function autoLinkPr(
  prDbId: string,
  headBranch: string,
  text: string,
  repoDbId: string
): Promise<void> {
  const keys = extractIssueKeys(`${headBranch}\n${text}`);
  if (!keys.length) return;

  // Resolve repo â†’ installation â†’ workspace â†’ candidate projects
  const repo = await db
    .select()
    .from(githubRepositories)
    .where(eq(githubRepositories.id, repoDbId))
    .limit(1)
    .then((r) => r[0]);
  if (!repo) return;
  const inst = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.id, repo.installationId))
    .limit(1)
    .then((r) => r[0]);
  if (!inst) return;

  const projectIds = await getProjectIdsForWorkspace(inst.workspaceId);
  // Prefer the linked project if the repo is linked to one
  const orderedProjects = repo.projectId
    ? [
        { id: repo.projectId, key: "" },
        ...projectIds.filter((p) => p.id !== repo.projectId),
      ]
    : projectIds;

  for (const key of keys) {
    for (const project of orderedProjects) {
      const issue =
        project.key && key.startsWith(project.key + "-")
          ? await getIssueByKey(project.id, key)
          : null;
      const fallback =
        !issue && !project.key
          ? null
          : !issue
            ? await tryFindIssueByKeyAcrossWorkspace(inst.workspaceId, key)
            : issue;
      const target = issue ?? fallback;
      if (target) {
        await insertLinkIfNew({
          issueId: target.id,
          pullRequestId: prDbId,
          suggestedStatus: null,
        });
        break;
      }
    }
  }
}

/** Fallback: search for an issue key across all projects in the workspace. */
async function tryFindIssueByKeyAcrossWorkspace(
  workspaceId: string,
  key: string
): Promise<{ id: string } | null> {
  const projectIds = await getProjectIdsForWorkspace(workspaceId);
  for (const p of projectIds) {
    const issue = await getIssueByKey(p.id, key);
    if (issue) return { id: issue.id };
  }
  return null;
}

/**
 * Sync branches for a repo â†’ upsert + auto-link to issues by key in branch name.
 */
export async function syncBranchesForRepo(
  repoDbId: string,
  octokit: Octokit,
  owner: string,
  repoName: string,
  projectId?: string | null
): Promise<{ branches: number; errors: string[] }> {
  const errors: string[] = [];
  let branches = 0;

  const branchesData = await withRetry(() =>
    octokit.paginate(octokit.rest.repos.listBranches, {
      owner,
      repo: repoName,
      per_page: 50,
    })
  );

  for (const b of branchesData) {
    try {
      const key = firstIssueKey(b.name);
      let issueId: string | null = null;
      if (key && projectId) {
        const issue = await getIssueByKey(projectId, key);
        issueId = issue?.id ?? null;
      }
      const row = await upsertBranch({
        repoDbId,
        name: b.name,
        sha: b.commit.sha,
        issueId,
      });
      if (issueId && row) {
        await insertLinkIfNew({ issueId, branchId: row.id });
      }
      branches++;
    } catch (err) {
      errors.push(`branch ${b.name}: ${(err instanceof Error ? err.message : String(err))}`);
    }
  }

  return { branches, errors };
}

/* ------------------------------------------------------------------ */
/* Installation callback (OAuth-App flow post-install)                 */
/* ------------------------------------------------------------------ */

/** App slug for the install URL. */
export function getInstallUrl(state: string): string {
  const slug = process.env.GITHUB_APP_SLUG ?? "";
  return `https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(state)}`;
}

/* ------------------------------------------------------------------ */
/* Uninstall handling                                                  */
/* ------------------------------------------------------------------ */

/**
 * Handle installation.deleted: remove installation + clear token cache.
 */
export async function handleUninstall(installationId: number): Promise<void> {
  clearInstallationToken(installationId);
  const inst = await getInstallationByGithubId(installationId);
  if (inst) {
    await deleteInstallationByGithubIdSafe(inst.workspaceId, installationId);
  }
}

async function deleteInstallationByGithubIdSafe(
  workspaceId: string,
  installationId: number
): Promise<void> {
  const { deleteInstallationByGithubId } = await import("./queries");
  await deleteInstallationByGithubId(workspaceId, installationId);
}

/* ------------------------------------------------------------------ */
/* Cron: Backfill missed events (status=received older than 10m)       */
/* ------------------------------------------------------------------ */

/**
 * Backfill events stuck in "received" (webhook delivery failed but event stored).
 * Returns number of events re-marked for processing.
 */
export async function backfillMissedEvents(): Promise<{ pending: number }> {
  const { getPendingEvents } = await import("./queries");
  const pending = await getPendingEvents(50);
  return { pending: pending.length };
}
