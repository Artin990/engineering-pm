import { desc, and, eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";

export type ActivityVerb =
  | "created" | "updated" | "status_changed" | "assigned" | "commented"
  | "dependency_added" | "archived" | "merged" | "pr_opened" | "pr_reviewed"
  | "pushed" | "cycle_started" | "cycle_completed" | "milestone_reached";

export type EntityType =
  | "issue" | "project" | "comment" | "pr" | "commit"
  | "branch" | "cycle" | "milestone" | "member";

export type LogActivityInput = {
  workspaceId: string;
  projectId?: string | null;
  actorId?: string | null;
  kind: "internal" | "github";
  verb: ActivityVerb;
  entityType: EntityType;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** ثبت رویداد داخلی یا گیت‌هابی در تایم‌لاین یکپارچه. */
export async function logActivity(input: LogActivityInput) {
  const [row] = await db
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
  return row;
}

/** فید یکپارچه پروژه — صفحه‌بندی‌شده با ایندکس (project_id, created_at desc). */
export async function getProjectActivityFeed(
  projectId: string,
  opts: { limit?: number; cursor?: string } = {}
) {
  const limit = Math.min(opts.limit ?? 20, 100);
  const cursorDate = opts.cursor ? new Date(opts.cursor) : null;

  if (cursorDate && !Number.isNaN(cursorDate.getTime())) {
    return db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.projectId, projectId),
          lt(activities.createdAt, cursorDate)
        )
      )
      .orderBy(desc(activities.createdAt))
      .limit(limit + 1);
  }

  return db
    .select()
    .from(activities)
    .where(eq(activities.projectId, projectId))
    .orderBy(desc(activities.createdAt))
    .limit(limit + 1);
}

/** فید workspace — برای صفحه overview. */
export async function getWorkspaceActivityFeed(
  workspaceId: string,
  opts: { limit?: number; cursor?: string } = {}
) {
  const limit = Math.min(opts.limit ?? 20, 100);
  if (opts.cursor) {
    const cursorDate = new Date(opts.cursor);
    return db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.workspaceId, workspaceId),
          lt(activities.createdAt, cursorDate)
        )
      )
      .orderBy(desc(activities.createdAt))
      .limit(limit + 1);
  }
  return db
    .select()
    .from(activities)
    .where(eq(activities.workspaceId, workspaceId))
    .orderBy(desc(activities.createdAt))
    .limit(limit + 1);
}
