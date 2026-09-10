/**
 * GitHub ↔ Issue auto-linking + status suggestions.
 *
 * SSOT rule (DOC-04 §2 + master plan §SSOT):
 * - GitHub NEVER writes internal data.
 * - GitHub only SUGGESTS a status (e.g. PR merged → "done").
 * - The user must accept/reject the suggestion.
 */
import { db } from "@/lib/db";
import {
  githubInstallations,
  githubIssueLinks,
  githubRepositories,
  issues,
  projects,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { extractIssueKeys } from "./keys";
import {
  getIssueByKey,
  getPendingSuggestionsForProject,
  insertLinkIfNew,
  updateIssueStatus,
  updateSuggestionState,
} from "./queries";

/* ------------------------------------------------------------------ */
/* Status mapping                                                      */
/* ------------------------------------------------------------------ */

/**
 * Suggest an issue status from a GitHub event.
 * - PR opened           → in_review
 * - PR merged           → done
 * - PR closed (no merge)→ in_progress
 * - branch created      → in_progress
 */
export function suggestStatusFromEvent(
  eventType: "pr_opened" | "pr_merged" | "pr_closed" | "branch_created"
): string | null {
  switch (eventType) {
    case "pr_merged":
      return "done";
    case "pr_opened":
      return "in_review";
    case "branch_created":
      return "in_progress";
    case "pr_closed":
      return "in_progress";
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Issue resolution                                                    */
/* ------------------------------------------------------------------ */

async function findIssueInWorkspace(
  workspaceId: string,
  key: string,
  preferredProjectId: string | null
): Promise<{ id: string } | null> {
  // 1. Preferred project (repo linked to project)
  if (preferredProjectId) {
    const issue = await getIssueByKey(preferredProjectId, key);
    if (issue) return issue;
  }
  // 2. All projects in the workspace
  const rows = await db
    .select({ id: issues.id })
    .from(issues)
    .innerJoin(projects, eq(issues.projectId, projects.id))
    .where(and(eq(projects.workspaceId, workspaceId), eq(issues.key, key)))
    .limit(1);
  return rows[0] ?? null;
}

async function resolveRepoContext(repoDbId: string) {
  const repoRows = await db
    .select()
    .from(githubRepositories)
    .where(eq(githubRepositories.id, repoDbId))
    .limit(1);
  const repo = repoRows[0];
  if (!repo) return null;

  const instRows = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.id, repo.installationId))
    .limit(1);
  const inst = instRows[0];
  if (!inst) return null;

  return { repo, installation: inst };
}

/* ------------------------------------------------------------------ */
/* Auto-link PR → issue                                                */
/* ------------------------------------------------------------------ */

/**
 * Auto-link a PR to internal issues by keys found in headBranch / title / body.
 * Returns linked issue IDs.
 */
export async function autoLinkIssuePr(input: {
  prDbId: string;
  headBranch: string;
  title: string;
  body?: string | null;
  repoDbId: string;
}): Promise<string[]> {
  const keys = extractIssueKeys(
    `${input.headBranch}\n${input.title}\n${input.body ?? ""}`
  );
  if (!keys.length) return [];

  const ctx = await resolveRepoContext(input.repoDbId);
  if (!ctx) return [];

  const linked: string[] = [];
  for (const key of keys) {
    const issue = await findIssueInWorkspace(
      ctx.installation.workspaceId,
      key,
      ctx.repo.projectId
    );
    if (issue) {
      await insertLinkIfNew({ issueId: issue.id, pullRequestId: input.prDbId });
      linked.push(issue.id);
    }
  }
  return linked;
}

/* ------------------------------------------------------------------ */
/* Auto-link branch → issue                                            */
/* ------------------------------------------------------------------ */

export async function autoLinkBranch(input: {
  branchDbId: string;
  branchName: string;
  repoDbId: string;
}): Promise<string[]> {
  const keys = extractIssueKeys(input.branchName);
  if (!keys.length) return [];

  const ctx = await resolveRepoContext(input.repoDbId);
  if (!ctx) return [];

  const linked: string[] = [];
  for (const key of keys) {
    const issue = await findIssueInWorkspace(
      ctx.installation.workspaceId,
      key,
      ctx.repo.projectId
    );
    if (issue) {
      await insertLinkIfNew({ issueId: issue.id, branchId: input.branchDbId });
      linked.push(issue.id);
    }
  }
  return linked;
}

/* ------------------------------------------------------------------ */
/* Suggestions                                                         */
/* ------------------------------------------------------------------ */

/**
 * Create a status suggestion for all issues linked to a PR.
 * e.g. PR merged → suggest "done" on every linked issue.
 */
export async function suggestStatusForPr(
  prDbId: string,
  eventType: "pr_opened" | "pr_merged" | "pr_closed"
): Promise<number> {
  const suggested = suggestStatusFromEvent(eventType);
  if (!suggested) return 0;

  const links = await db
    .select()
    .from(githubIssueLinks)
    .where(eq(githubIssueLinks.pullRequestId, prDbId));

  let count = 0;
  for (const link of links) {
    // Only suggest for links that don't have an already-accepted suggestion
    if (link.suggestionState === "accepted") continue;
    await db
      .update(githubIssueLinks)
      .set({
        suggestedStatus: suggested as typeof githubIssueLinks.$inferInsert.suggestedStatus,
        suggestionState: "pending",
        updatedAt: new Date(),
      })
      .where(eq(githubIssueLinks.id, link.id));
    count++;
  }
  return count;
}

/** List pending suggestions for a project. */
export async function listSuggestions(projectId: string) {
  return getPendingSuggestionsForProject(projectId);
}

/**
 * Accept a suggestion → write the suggested status to the issue (SSOT handoff).
 */
export async function acceptSuggestion(linkId: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(githubIssueLinks)
    .where(eq(githubIssueLinks.id, linkId))
    .limit(1);
  const link = rows[0];
  if (!link?.suggestedStatus) return false;

  await updateIssueStatus(link.issueId, link.suggestedStatus);
  await updateSuggestionState(linkId, "accepted");
  return true;
}

/** Reject a suggestion → mark rejected, do NOT touch the issue. */
export async function rejectSuggestion(linkId: string): Promise<boolean> {
  const updated = await updateSuggestionState(linkId, "rejected");
  return Boolean(updated);
}
