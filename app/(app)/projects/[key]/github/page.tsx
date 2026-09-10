/**
 * GitHub tab — Project settings > GitHub.
 *
 * Sections (DOC-04 §5):
 * - Install status (connect / disconnect GitHub App)
 * - Repositories (list + link-to-project actions)
 * - Pull requests (recent + state)
 * - Pending status suggestions (accept/reject — SSOT stays internal)
 */
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  githubCommits,
  githubInstallations,
  githubIssueLinks,
  githubPullRequests,
  githubRepositories,
  issues,
  projects,
  workspaces,
} from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getProjectRole } from "@/lib/auth/rbac";
import { listReposByWorkspace } from "@/lib/github/queries";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ key: string }> };

export default async function GithubPage({ params }: PageProps) {
  const { key } = await params;

  // Auth + project resolution (same pattern as other tabs)
  let profileId: string;
  try {
    ({ profileId } = await getSession());
  } catch {
    redirect("/login");
  }

  const [project] = await db
    .select({ id: projects.id, workspaceId: projects.workspaceId, name: projects.name, key: projects.key })
    .from(projects)
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .where(and(eq(projects.key, key.toUpperCase())))
    .limit(1);
  if (!project) notFound();

  const role = await getProjectRole(profileId, project.id);
  if (!role) redirect("/projects");

  // ── Installations for this workspace ──────────────────────────────────────
  const installations = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.workspaceId, project.workspaceId));

  // ── Repos (all from installations, mark linked to this project) ──────────
  const allRepos = await listReposByWorkspace(project.workspaceId);

  // ── Recent PRs for repos linked to this project ───────────────────────────
  const prs = await db
    .select({
      id: githubPullRequests.id,
      prNumber: githubPullRequests.prNumber,
      title: githubPullRequests.title,
      state: githubPullRequests.state,
      authorLogin: githubPullRequests.authorLogin,
      url: githubPullRequests.url,
      repoName: githubRepositories.name,
      updatedAt: githubPullRequests.updatedAt,
    })
    .from(githubPullRequests)
    .innerJoin(githubRepositories, eq(githubPullRequests.repoId, githubRepositories.id))
    .where(eq(githubRepositories.projectId, project.id))
    .orderBy(desc(githubPullRequests.updatedAt))
    .limit(15);

  // ── Recent commits for linked repos ───────────────────────────────────────
  const commits = await db
    .select({
      id: githubCommits.id,
      sha: githubCommits.sha,
      message: githubCommits.message,
      authorLogin: githubCommits.authorLogin,
      branch: githubCommits.branch,
      committedAt: githubCommits.committedAt,
      repoName: githubRepositories.name,
    })
    .from(githubCommits)
    .innerJoin(githubRepositories, eq(githubCommits.repoId, githubRepositories.id))
    .where(eq(githubRepositories.projectId, project.id))
    .orderBy(desc(githubCommits.committedAt))
    .limit(15);

  // ── Pending suggestions for this project ──────────────────────────────────
  const suggestions = await db
    .select({
      linkId: githubIssueLinks.id,
      issueKey: issues.key,
      issueTitle: issues.title,
      issueStatus: issues.status,
      suggestedStatus: githubIssueLinks.suggestedStatus,
      prNumber: githubPullRequests.prNumber,
      repoName: githubRepositories.name,
    })
    .from(githubIssueLinks)
    .innerJoin(issues, eq(githubIssueLinks.issueId, issues.id))
    .leftJoin(githubPullRequests, eq(githubIssueLinks.pullRequestId, githubPullRequests.id))
    .leftJoin(githubRepositories, eq(githubPullRequests.repoId, githubRepositories.id))
    .where(
      and(
        eq(issues.projectId, project.id),
        eq(githubIssueLinks.suggestionState, "pending")
      )
    )
    .limit(20);

  const connected = installations.length > 0;
  const appSlug = process.env.GITHUB_APP_SLUG ?? "";
  const installUrl = appSlug
    ? `https://github.com/apps/${appSlug}/installations/new?state=${project.workspaceId}`
    : null;

  return (
    <div className="space-y-8">
      {/* ── Connection status ─────────────────────────────────────────────── */}
      <section className="rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {connected ? "متصل به GitHub" : "اتصال GitHub"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {connected
                ? `${installations.length} نصب فعال — حساب: ${installations.map((i) => i.accountLogin).join(", ")}`
                : "برای همگام‌سازی PR‌ها و کامیت‌ها، ابتدا GitHub App را نصب کنید."}
            </p>
          </div>
          {installUrl && (
            <a
              href={installUrl}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {connected ? "مدیریت نصب" : "نصب GitHub App"}
            </a>
          )}
          {!installUrl && (
            <span className="text-xs text-muted-foreground">
              GITHUB_APP_SLUG تنظیم نشده — به مستندات مراجعه کنید.
            </span>
          )}
        </div>
      </section>

      {/* ── Repositories ──────────────────────────────────────────────────── */}
      <section>
        <h3 className="mb-3 text-sm font-semibold">مخازن ({allRepos.length})</h3>
        {allRepos.length === 0 ? (
          <p className="text-sm text-muted-foreground">هنوز مخزنی همگام نشده.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {allRepos.map((repo) => (
              <li key={repo.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-mono text-sm">{repo.name}</span>
                  {repo.isPrivate && (
                    <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      private
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {repo.projectId ? "لینک‌شده به پروژه" : "بدون پروژه"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Pull requests ─────────────────────────────────────────────────── */}
      <section>
        <h3 className="mb-3 text-sm font-semibold">Pull Request‌های اخیر</h3>
        {prs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            PR‌ای برای مخازن لینک‌شده به این پروژه یافت نشد.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {prs.map((pr) => (
              <li key={pr.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <a
                    href={pr.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-sm font-medium hover:underline"
                  >
                    #{pr.prNumber} — {pr.title}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {pr.repoName} · {pr.authorLogin}
                  </p>
                </div>
                <span className="rounded bg-muted px-2 py-1 text-xs">{pr.state}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Commits ───────────────────────────────────────────────────────── */}
      <section>
        <h3 className="mb-3 text-sm font-semibold">کامیت‌های اخیر</h3>
        {commits.length === 0 ? (
          <p className="text-sm text-muted-foreground">کامیتی یافت نشد.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {commits.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-2">
                <div className="min-w-0">
                  <span className="font-mono text-xs text-muted-foreground">
                    {c.sha.slice(0, 7)}
                  </span>
                  <span className="mr-3 truncate text-sm">{c.message}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {c.authorLogin} · {c.branch}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Suggestions ───────────────────────────────────────────────────── */}
      <section>
        <h3 className="mb-3 text-sm font-semibold">
          پیشنهادهای وضعیت ({suggestions.length})
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          GitHub وضعیت پیشنهاد می‌دهد؛ تأیید نهایی با شماست (SSOT داخلی).
        </p>
        {suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">پیشنهاد فعالی وجود ندارد.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {suggestions.map((s) => (
              <li key={s.linkId} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-medium text-sm">{s.issueKey}</span>
                  <span className="mr-2 text-sm">{s.issueTitle}</span>
                  <p className="text-xs text-muted-foreground">
                    {s.repoName ? `${s.repoName}#${s.prNumber} → ` : ""}
                    پیشنهاد: {s.suggestedStatus} (فعلی: {s.issueStatus})
                  </p>
                </div>
                <SuggestionActions linkId={s.linkId} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Client component for accept/reject actions. */
import SuggestionActions from "./suggestion-actions";
