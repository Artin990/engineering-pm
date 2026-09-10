import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import {
  issues,
  issueComments,
  issueDependencies,
  issueLabels,
  issueAssignees,
  labels,
  milestones,
  modules,
  cycles,
  projectMembers,
} from "@/lib/db/schema";
import type { CreateIssueInput, UpdateIssueInput } from "@/lib/validators";

// ---------- Issue CRUD ----------

export async function getIssueById(issueId: string) {
  const [row] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getIssueByKey(projectId: string, key: string) {
  const [row] = await db
    .select()
    .from(issues)
    .where(
      and(eq(issues.projectId, projectId), eq(issues.key, key), isNull(issues.deletedAt))
    )
    .limit(1);
  return row ?? null;
}

export async function listProjectIssues(projectId: string) {
  return db
    .select()
    .from(issues)
    .where(and(eq(issues.projectId, projectId), isNull(issues.deletedAt)))
    .orderBy(desc(issues.createdAt));
}

/** تولید کلید ایشوی بعدی مثل PM-143 */
export async function nextIssueKey(projectId: string, projectKey: string): Promise<string> {
  const [row] = await db
    .select({ maxKey: sql<string>`max(key)` })
    .from(issues)
    .where(eq(issues.projectId, projectId));

  const maxNum = row?.maxKey
    ? Number.parseInt(row.maxKey.split("-")[1] ?? "0", 10)
    : 0;
  return `${projectKey}-${maxNum + 1}`;
}

export async function createIssue(
  projectId: string,
  projectKey: string,
  createdBy: string,
  input: CreateIssueInput
) {
  const key = input.key ?? (await nextIssueKey(projectId, projectKey));
  const id = input.id ?? randomUUID();

  const [issue] = await db
    .insert(issues)
    .values({
      id,
      projectId,
      key: typeof key === "string" ? key : key,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "backlog",
      priority: input.priority ?? "none",
      type: input.type ?? "task",
      estimate: input.estimate ?? 1,
      dueDate: input.dueDate ?? null,
      milestoneId: input.milestoneId ?? null,
      moduleId: input.moduleId ?? null,
      cycleId: input.cycleId ?? null,
      createdBy,
    })
    .returning();

  if (input.assigneeId) {
    await db.insert(issueAssignees).values({ issueId: id, userId: input.assigneeId });
  }

  return issue;
}

export async function updateIssue(issueId: string, input: UpdateIssueInput) {
  const values: Record<string, unknown> = {};
  if (input.title !== undefined) values.title = input.title;
  if (input.description !== undefined) values.description = input.description;
  if (input.status !== undefined) {
    values.status = input.status;
    if (input.status === "done") values.closedAt = new Date();
    else values.closedAt = null;
  }
  if (input.priority !== undefined) values.priority = input.priority;
  if (input.type !== undefined) values.type = input.type;
  if (input.estimate !== undefined) values.estimate = input.estimate;
  if (input.dueDate !== undefined) values.dueDate = input.dueDate;
  if (input.milestoneId !== undefined) values.milestoneId = input.milestoneId;
  if (input.moduleId !== undefined) values.moduleId = input.moduleId;
  if (input.cycleId !== undefined) values.cycleId = input.cycleId;
  if (input.assigneeId !== undefined) values.assigneeId = input.assigneeId;
  if (input.parentId !== undefined) values.parentId = input.parentId;

  if (Object.keys(values).length === 0) return await getIssueById(issueId);

  const [updated] = await db
    .update(issues)
    .set(values)
    .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
    .returning();
  return updated ?? null;
}

export async function archiveIssue(issueId: string) {
  const [archived] = await db
    .update(issues)
    .set({ deletedAt: new Date() })
    .where(eq(issues.id, issueId))
    .returning();
  return archived ?? null;
}

// ---------- Assignees (many-to-many) ----------

export async function listIssueAssignees(issueId: string) {
  return db
    .select({ userId: issueAssignees.userId })
    .from(issueAssignees)
    .where(eq(issueAssignees.issueId, issueId));
}

export async function addIssueAssignee(issueId: string, userId: string) {
  await db.insert(issueAssignees).values({ issueId, userId }).onConflictDoNothing();
}

export async function removeIssueAssignee(issueId: string, userId: string) {
  await db
    .delete(issueAssignees)
    .where(and(eq(issueAssignees.issueId, issueId), eq(issueAssignees.userId, userId)));
}

// ---------- Dependencies ----------

export async function listIssueDependencies(issueId: string) {
  return db
    .select({ dependsOnId: issueDependencies.dependsOnId })
    .from(issueDependencies)
    .where(eq(issueDependencies.issueId, issueId));
}

export async function addIssueDependency(issueId: string, dependsOnId: string) {
  await db.insert(issueDependencies).values({ issueId, dependsOnId }).onConflictDoNothing();
}

export async function removeIssueDependency(issueId: string, dependsOnId: string) {
  await db
    .delete(issueDependencies)
    .where(
      and(
        eq(issueDependencies.issueId, issueId),
        eq(issueDependencies.dependsOnId, dependsOnId)
      )
    );
}

// ---------- Comments ----------

export async function listIssueComments(issueId: string) {
  return db
    .select()
    .from(issueComments)
    .where(and(eq(issueComments.issueId, issueId), isNull(issueComments.deletedAt)))
    .orderBy(desc(issueComments.createdAt));
}

export async function addIssueComment(issueId: string, authorId: string, body: string) {
  const [comment] = await db
    .insert(issueComments)
    .values({ issueId, authorId, body })
    .returning();
  return comment;
}

export async function updateComment(commentId: string, body: string) {
  const [updated] = await db
    .update(issueComments)
    .set({ body })
    .where(and(eq(issueComments.id, commentId), isNull(issueComments.deletedAt)))
    .returning();
  return updated ?? null;
}

export async function softDeleteComment(commentId: string) {
  await db
    .update(issueComments)
    .set({ deletedAt: new Date() })
    .where(eq(issueComments.id, commentId));
}

// ---------- Labels ----------

export async function listProjectLabels(projectId: string) {
  return db.select().from(labels).where(eq(labels.projectId, projectId));
}

export async function createLabel(projectId: string, name: string, color: string = "#71717A") {
  const [label] = await db
    .insert(labels)
    .values({ projectId, name, color })
    .onConflictDoNothing()
    .returning();
  return label ?? null;
}

export async function setIssueLabels(issueId: string, labelIds: string[]) {
  // حذف همه لیبل‌های قبلی و جایگزینی
  await db.delete(issueLabels).where(eq(issueLabels.issueId, issueId));
  if (labelIds.length > 0) {
    await db.insert(issueLabels).values(labelIds.map((lid) => ({ issueId, labelId: lid })));
  }
}

export async function listIssueLabelIds(issueId: string) {
  const rows = await db
    .select({ labelId: issueLabels.labelId })
    .from(issueLabels)
    .where(eq(issueLabels.issueId, issueId));
  return rows.map((r) => r.labelId);
}

// ---------- Milestones / Modules / Cycles (read helpers) ----------

export async function listMilestones(projectId: string) {
  return db
    .select()
    .from(milestones)
    .where(and(eq(milestones.projectId, projectId), isNull(milestones.deletedAt)))
    .orderBy(milestones.order);
}

export async function createMilestoneInDb(projectId: string, data: {
  title: string;
  description?: string | null;
  targetDate?: string | null;
  order?: number;
}) {
  const [ms] = await db
    .insert(milestones)
    .values({
      projectId,
      title: data.title,
      description: data.description ?? null,
      targetDate: data.targetDate ?? null,
      order: data.order ?? 0,
    })
    .returning();
  return ms;
}

export async function updateMilestoneInDb(milestoneId: string, data: Record<string, unknown>) {
  if (Object.keys(data).length === 0) return null;
  const [updated] = await db
    .update(milestones)
    .set(data)
    .where(and(eq(milestones.id, milestoneId), isNull(milestones.deletedAt)))
    .returning();
  return updated ?? null;
}

export async function listModules(projectId: string) {
  return db
    .select()
    .from(modules)
    .where(and(eq(modules.projectId, projectId), isNull(modules.deletedAt)));
}

export async function createModuleInDb(projectId: string, name: string, description?: string | null) {
  const [mod] = await db
    .insert(modules)
    .values({ projectId, name, description: description ?? null })
    .returning();
  return mod;
}

export async function listCycles(projectId: string) {
  return db
    .select()
    .from(cycles)
    .where(and(eq(cycles.projectId, projectId), isNull(cycles.deletedAt)))
    .orderBy(desc(cycles.startDate));
}

/** userIdهای اعضای پروژه — برای اعلان‌های گروهی. */
export async function listProjectMemberIds(projectId: string) {
  const rows = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, projectId));
  return rows.map((r) => r.userId);
}

export async function createCycleInDb(projectId: string, data: {
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
}) {
  const [cycle] = await db
    .insert(cycles)
    .values({
      projectId,
      name: data.name,
      goal: data.goal ?? null,
      startDate: data.startDate,
      endDate: data.endDate,
    })
    .returning();
  return cycle;
}

export async function updateCycleInDb(cycleId: string, data: Record<string, unknown>) {
  if (Object.keys(data).length === 0) return null;
  const [updated] = await db
    .update(cycles)
    .set(data)
    .where(and(eq(cycles.id, cycleId), isNull(cycles.deletedAt)))
    .returning();
  return updated ?? null;
}
