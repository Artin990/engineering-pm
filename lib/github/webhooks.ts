/**
 * GitHub webhook event processors.
 *
 * Called asynchronously after the webhook route returns 202 to GitHub.
 * Every processor is idempotent (safe to retry).
 *
 * Events (DOC-04 §2):
 *  - installation (created / deleted / suspend / unsuspend)
 *  - installation_repositories (added / removed)
 *  - push
 *  - pull_request (opened / synchronize / closed / reopened / edited / ready_for_review)
 *  - pull_request_review (submitted / dismissed / changes_requested / approved / commented)
 *  - issue_comment (bonus — enables future task-completion scoring)
 */
import { db } from "@/lib/db";
import { githubRepositories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { autoLinkBranch, autoLinkIssuePr, suggestStatusForPr } from "./links";
import { resolveAuthorId } from "./author";
import {
  deleteBranch,
  deleteInstallationByGithubId,
  getInstallationByGithubId,
  getPrByRepoAndNumber,
  insertActivity,
  insertCommitIgnore,
  insertReviewIgnore,
  markEventFailed,
  markEventProcessed,
  upsertBranch,
  upsertInstallation,
  upsertPr,
  upsertRepo,
} from "./queries";

/* ------------------------------------------------------------------ */
/* Payload helpers (avoid `any` while staying flexible)                */
/* ------------------------------------------------------------------ */

/** Loose JSON value — mirrors the structure GitHub sends without using `any`. */
interface JsonMap {
  [key: string]:
    | string
    | number
    | boolean
    | null
    | undefined
    | JsonMap
    | JsonMap[];
}

function isRecord(v: unknown): v is JsonMap {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : fallback;
}

function bool(v: unknown): boolean {
  return v === true;
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                          */
/* ------------------------------------------------------------------ */

export type GithubEventRow = {
  deliveryId: string;
  event: string;
  action: string | null;
  installationId: number | null;
  repoFullName: string | null;
  payload: unknown;
};

export async function processWebhookEvent(row: GithubEventRow): Promise<void> {
  try {
    if (!isRecord(row.payload)) {
      await markEventProcessed(row.deliveryId);
      return;
    }
    const payload = row.payload;

    switch (row.event) {
      case "installation":
        await handleInstallation(row.action, payload, row.installationId);
        break;
      case "installation_repositories":
        await handleInstallationRepositories(row.action, payload, row.installationId);
        break;
      case "push":
        await handlePush(payload, row.installationId, row.repoFullName);
        break;
      case "pull_request":
        await handlePullRequest(row.action, payload, row.installationId, row.repoFullName);
        break;
      case "pull_request_review":
        await handlePullRequestReview(payload, row.installationId, row.repoFullName);
        break;
      default:
        // Unsupported event — mark processed so it doesn't block the queue
        break;
    }
    await markEventProcessed(row.deliveryId);
  } catch (err) {
    console.error(`[github-webhook] failed ${row.event}/${row.action}`, err);
    await markEventFailed(row.deliveryId);
  }
}

/* ------------------------------------------------------------------ */
/* installation                                                        */
/* ------------------------------------------------------------------ */

async function handleInstallation(
  action: string | null,
  payload: JsonMap,
  installationId: number | null
): Promise<void> {
  if (!installationId || !payload.installation) return;
  const inst = isRecord(payload.installation) ? payload.installation : {};
  const account = isRecord(inst.account) ? inst.account : undefined;
  const accountLogin = str(account?.login, String(installationId));
  const accountType = str(account?.type, "User");

  switch (action) {
    case "created":
    case "new_permissions_accepted": {
      const existing = await getInstallationByGithubId(installationId);
      if (existing) {
        await upsertInstallation({
          workspaceId: existing.workspaceId,
          installationId,
          accountLogin,
          accountType,
        });
      }
      break;
    }
    case "deleted": {
      const existing = await getInstallationByGithubId(installationId);
      if (existing) {
        await deleteInstallationByGithubId(existing.workspaceId, installationId);
      }
      break;
    }
    // suspend/unsuspend: informational only (no column for suspension)
  }
}

/* ------------------------------------------------------------------ */
/* installation_repositories                                           */
/* ------------------------------------------------------------------ */

async function handleInstallationRepositories(
  action: string | null,
  payload: JsonMap,
  installationId: number | null
): Promise<void> {
  if (!installationId) return;
  const inst = await getInstallationByGithubId(installationId);
  if (!inst) return;

  const added = Array.isArray(payload.repositories_added) ? payload.repositories_added : [];
  const removed = Array.isArray(payload.repositories_removed) ? payload.repositories_removed : [];

  if (action === "added") {
    for (const repo of added) {
      if (!isRecord(repo)) continue;
      await upsertRepo({
        installationDbId: inst.id,
        repoId: num(repo.id),
        name: str(repo.full_name),
        isPrivate: bool(repo.private),
      });
    }
  }

  if (action === "removed") {
    for (const repo of removed) {
      if (!isRecord(repo)) continue;
      const rows = await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.repoId, num(repo.id)))
        .limit(1);
      if (rows[0]) {
        await db.delete(githubRepositories).where(eq(githubRepositories.id, rows[0].id));
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* push                                                                */
/* ------------------------------------------------------------------ */

async function handlePush(
  payload: JsonMap,
  installationId: number | null,
  repoFullName: string | null
): Promise<void> {
  if (!installationId || !repoFullName) return;
  const inst = await getInstallationByGithubId(installationId);
  if (!inst) return;

  const repo = await db
    .select()
    .from(githubRepositories)
    .where(eq(githubRepositories.installationId, inst.id))
    .then((rows) => rows.find((r) => r.name === repoFullName));
  if (!repo) return;

  const ref = str(payload.ref); // "refs/heads/main"
  const branch = ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref;
  const commits = Array.isArray(payload.commits) ? payload.commits : [];
  const isDelete = bool(payload.deleted);

  if (isDelete || !branch) {
    if (branch) await deleteBranch(repo.id, branch);
    return;
  }

  const branchRow = await upsertBranch({
    repoDbId: repo.id,
    name: branch,
    sha: str(payload.after),
  });

  // Auto-link branch → issue by key in branch name
  if (branchRow) {
    await autoLinkBranch({
      branchDbId: branchRow.id,
      branchName: branch,
      repoDbId: repo.id,
    });
  }

  // Insert new commits
  for (const raw of commits) {
    if (!isRecord(raw)) continue;
    const sha = str(raw.id);
    if (!sha) continue;
    const author = isRecord(raw.author) ? raw.author : undefined;
    const authorLogin = author?.username != null ? str(author.username) : null;
    const authorId = await resolveAuthorId(authorLogin);
    await insertCommitIgnore({
      repoDbId: repo.id,
      sha,
      message: str(raw.message),
      authorLogin,
      authorId,
      branch,
      committedAt: raw.timestamp ? new Date(str(raw.timestamp)) : new Date(),
    });
  }

  // Activity log
  if (commits.length > 0) {
    const pusher = isRecord(payload.pusher) ? payload.pusher : undefined;
    await insertActivity({
      workspaceId: inst.workspaceId,
      projectId: repo.projectId,
      kind: "github",
      verb: "pushed",
      entityType: "repository",
      entityId: repo.id,
      metadata: { repo: repoFullName, branch, count: commits.length, pusher: pusher?.name ?? null },
    });
  }
}

/* ------------------------------------------------------------------ */
/* pull_request                                                        */
/* ------------------------------------------------------------------ */

async function handlePullRequest(
  action: string | null,
  payload: JsonMap,
  installationId: number | null,
  repoFullName: string | null
): Promise<void> {
  if (!installationId || !repoFullName) return;
  if (!isRecord(payload.pull_request)) return;
  const pr = payload.pull_request;

  const inst = await getInstallationByGithubId(installationId);
  if (!inst) return;

  const repo = await db
    .select()
    .from(githubRepositories)
    .where(eq(githubRepositories.installationId, inst.id))
    .then((rows) => rows.find((r) => r.name === repoFullName));
  if (!repo) return;

  const relevant = ["opened", "synchronize", "reopened", "closed", "edited", "ready_for_review"];
  if (!relevant.includes(action ?? "")) return;

  const head = isRecord(pr.head) ? pr.head : {};
  const base = isRecord(pr.base) ? pr.base : {};
  const user = isRecord(pr.user) ? pr.user : undefined;

  const state: "open" | "closed" | "merged" | "draft" =
    bool(pr.merged)
      ? "merged"
      : str(pr.state) === "closed"
        ? "closed"
        : bool(pr.draft)
          ? "draft"
          : "open";

  const authorLogin = str(user?.login, "unknown");
  const authorId = await resolveAuthorId(authorLogin);

  const { pr: prRow } = await upsertPr({
    repoDbId: repo.id,
    prNumber: num(pr.number),
    title: str(pr.title),
    body: pr.body != null ? str(pr.body) : null,
    state,
    authorLogin,
    authorId,
    headBranch: str(head.ref),
    baseBranch: str(base.ref),
    url: pr.html_url != null ? str(pr.html_url) : null,
    mergedAt: pr.merged_at ? new Date(str(pr.merged_at)) : null,
    closedAt: pr.closed_at ? new Date(str(pr.closed_at)) : null,
    githubCreatedAt: pr.created_at ? new Date(str(pr.created_at)) : null,
  });

  await autoLinkIssuePr({
    prDbId: prRow.id,
    headBranch: prRow.headBranch ?? "",
    title: prRow.title ?? "",
    body: prRow.body,
    repoDbId: repo.id,
  });

  if (action === "opened") {
    await suggestStatusForPr(prRow.id, "pr_opened");
  } else if (action === "closed" && bool(pr.merged)) {
    await suggestStatusForPr(prRow.id, "pr_merged");
  } else if (action === "closed") {
    await suggestStatusForPr(prRow.id, "pr_closed");
  }

  await insertActivity({
    workspaceId: inst.workspaceId,
    projectId: repo.projectId,
    kind: "github",
    verb: action === "closed" && bool(pr.merged) ? "merged" : `pr_${action}`,
    entityType: "pull_request",
    entityId: prRow.id,
    metadata: {
      repo: repoFullName,
      number: num(pr.number),
      title: str(pr.title),
      author: user?.login != null ? str(user.login) : null,
      url: pr.html_url != null ? str(pr.html_url) : null,
    },
  });
}

/* ------------------------------------------------------------------ */
/* pull_request_review                                                 */
/* ------------------------------------------------------------------ */

async function handlePullRequestReview(
  payload: JsonMap,
  installationId: number | null,
  repoFullName: string | null
): Promise<void> {
  if (!installationId || !repoFullName) return;
  const review = isRecord(payload.review) ? payload.review : null;
  const pr = isRecord(payload.pull_request) ? payload.pull_request : null;
  if (!review || !pr || review.id == null || pr.number == null) return;

  const inst = await getInstallationByGithubId(installationId);
  if (!inst) return;

  const repo = await db
    .select()
    .from(githubRepositories)
    .where(eq(githubRepositories.installationId, inst.id))
    .then((rows) => rows.find((r) => r.name === repoFullName));
  if (!repo) return;

  const prRow = await getPrByRepoAndNumber(repo.id, num(pr.number));
  if (!prRow) return;

  const reviewer = isRecord(review.user) ? review.user : undefined;

  await insertReviewIgnore({
    pullRequestDbId: prRow.id,
    reviewId: num(review.id),
    state: str(review.state, "COMMENTED"),
    reviewerLogin: str(reviewer?.login, "unknown"),
    submittedAt: review.submitted_at ? new Date(str(review.submitted_at)) : new Date(),
  });
}
