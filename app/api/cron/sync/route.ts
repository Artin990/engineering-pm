/**
 * Cron sync route — runs every 15 minutes via Vercel.
 * Protected by CRON_SECRET.
 *
 * Responsibilities:
 * 1. Process pending webhook events (status="received") — backfill missed deliveries
 * 2. Sync repos for all installations (reconciliation loop)
 * 3. Sync PRs + commits for active repos
 * 4. Send deadline notifications (issues due within 48h)
 */
import { NextResponse, type NextRequest } from "next/server";
import { lte, gte, and, isNull, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { githubRepositories, githubInstallations, issues } from "@/lib/db/schema";
import {
  getPendingEvents,
  createNotification,
  notificationExistsByDedupe,
} from "@/lib/github/queries";
import { processWebhookEvent } from "@/lib/github/webhooks";
import { syncInstallationRepos, syncPrsForRepo } from "@/lib/github/sync";
import { getInstallationOctokit } from "@/lib/github/token";
import { safeCompare } from "@/lib/github/signature";

export const dynamic = "force-dynamic";

function verifyCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const header = request.headers.get("authorization")?.replace(/^Bearer /i, "") ?? "";
  if (!secret) return false;
  return safeCompare(header, secret);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * GET /api/cron/sync
 */
export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results: Record<string, string | number> = {};

  // ── 1. Process pending events ─────────────────────────────────────────────
  try {
    const pending = await getPendingEvents(20);
    for (const row of pending) {
      await processWebhookEvent({
        deliveryId: row.deliveryId,
        event: row.event,
        action: row.action,
        installationId: row.installationId,
        repoFullName: row.repoFullName,
        payload: row.payload,
      });
    }
    results.processedEvents = pending.length;
  } catch (err) {
    results.eventsError = errorMessage(err);
  }

  // ── 2. Sync repos for all installations ───────────────────────────────────
  try {
    const allInst = await db.select().from(githubInstallations);
    let reposSynced = 0;
    for (const inst of allInst) {
      try {
        const r = await syncInstallationRepos(inst.installationId);
        reposSynced += r.repos;
      } catch (err) {
        console.error(`[cron] installation ${inst.installationId} sync failed`, err);
      }
    }
    results.reposSynced = reposSynced;
  } catch (err) {
    results.reposError = errorMessage(err);
  }

  // ── 3. Sync PRs for linked repos ──────────────────────────────────────────
  try {
    const linkedRepos = await db
      .select({
        id: githubRepositories.id,
        name: githubRepositories.name,
        installationId: githubInstallations.installationId,
      })
      .from(githubRepositories)
      .innerJoin(
        githubInstallations,
        eq(githubRepositories.installationId, githubInstallations.id)
      )
      .limit(20);

    let prsSynced = 0;
    for (const repo of linkedRepos) {
      try {
        const octokit = await getInstallationOctokit(repo.installationId);
        const [owner, name] = repo.name.split("/");
        if (!owner || !name) continue;
        const r = await syncPrsForRepo(repo.id, octokit, owner, name);
        prsSynced += r.prs;
      } catch (err) {
        console.error(`[cron] PR sync for ${repo.name} failed`, err);
      }
    }
    results.prsSynced = prsSynced;
  } catch (err) {
    results.prsError = errorMessage(err);
  }

  // ── 4. Deadline notifications (issues due in next 48 hours) ───────────────
  try {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const dueSoon = await db
      .select({
        id: issues.id,
        key: issues.key,
        title: issues.title,
        dueDate: issues.dueDate,
        projectId: issues.projectId,
        assigneeId: issues.assigneeId,
      })
      .from(issues)
      .where(
        and(
          isNull(issues.deletedAt),
          isNull(issues.closedAt),
          lte(issues.dueDate, in48h.toISOString().slice(0, 10)),
          gte(issues.dueDate, now.toISOString().slice(0, 10))
        )
      )
      .limit(50);

    let notified = 0;
    for (const issue of dueSoon) {
      if (!issue.assigneeId || !issue.dueDate) continue;
      const dedupeKey = `deadline:${issue.id}:${issue.dueDate}`;
      if (await notificationExistsByDedupe(dedupeKey)) continue;
      await createNotification({
        userId: issue.assigneeId,
        type: "deadline",
        title: `${issue.key}: ${issue.title}`,
        body: `مهلت تا ${issue.dueDate}`,
        link: `/projects/${issue.projectId}/issues/${issue.id}`,
        dedupeKey,
      });
      notified++;
    }
    results.deadlineNotifications = notified;
  } catch (err) {
    results.deadlineError = errorMessage(err);
  }

  return NextResponse.json({ data: results });
}
